// Run only in GitHub Actions, against the built site and real ONNX/WASM runtime.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const dist=resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const evidence=fileURLToPath(new URL('../browser-results/',import.meta.url));
await mkdir(evidence,{recursive:true});
const server=createServer(async(request,response)=>{
 try{
  const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  const target=resolve(dist,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!target.startsWith(dist+sep))throw Error('Invalid path');
  const bytes=await readFile(target);
  const type=target.endsWith('.wasm')?'application/wasm':target.endsWith('.mjs')||target.endsWith('.js')?'text/javascript':target.endsWith('.html')?'text/html':'application/octet-stream';
  response.writeHead(200,{'Content-Type':type});response.end(bytes);
 }catch{response.writeHead(404);response.end();}
});
await new Promise(resolve=>server.listen(8056,'127.0.0.1',resolve));
const browser=await chromium.launch();
const checks={},errors=[];
let page;
const photo=await readFile(new URL('../../test/778c75fc182f4ca939a220bd4954f4b8.webp',import.meta.url));
async function setup(options={}){
 const context=await browser.newContext({serviceWorkers:'block',...options});
 const current=await context.newPage();current.setDefaultTimeout(20000);
 current.on('pageerror',error=>errors.push(error.message));
 await current.goto('http://127.0.0.1:8056/');
 await current.waitForFunction(()=>!document.querySelector('#files').disabled);
 await current.locator('#files').setInputFiles({name:'sample.webp',mimeType:'image/webp',buffer:photo});
 await current.getByRole('button',{name:'局部抠图',exact:true}).waitFor();
 return {context,current};
}
async function regionFields(current){
 return current.locator('[data-coordinate]').evaluateAll(fields=>Object.fromEntries(fields.map(field=>[field.dataset.coordinate,Number(field.value)])));
}
async function fillRegion(current,box){
 for(const [key,value]of Object.entries(box))await current.locator(`[data-coordinate="${key}"]`).fill(String(value));
 await current.locator('[data-coordinate="h"]').blur();
}
async function snapshot(current){
 return current.evaluate(async()=>{
  const {openProjectStore}=await import('./project-store.mjs?v=region-2');
  const project=await (await openProjectStore()).load();
  return {size:project.size,items:project.items.map(({imageRevision,reviewedRevision,reviewed,status})=>({imageRevision,reviewedRevision,reviewed,status}))};
 });
}
async function cutoutStats(current,region){
 const url=await current.getByRole('link',{name:'下载透明底稿',exact:true}).getAttribute('href');
 return current.evaluate(async({url,region})=>{
  const blob=await (await fetch(url)).blob(),bitmap=await createImageBitmap(blob);
  const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d');
  ctx.drawImage(bitmap,0,0);
  const pixels=ctx.getImageData(0,0,bitmap.width,bitmap.height).data;
  let inside=0,outside=0;
  for(let y=0;y<bitmap.height;y++)for(let x=0;x<bitmap.width;x++){
   const i=(y*bitmap.width+x)*4,inBox=x>=region.x&&x<region.x+region.w&&y>=region.y&&y<region.y+region.h;
   if(pixels[i+3]>0){if(inBox)inside++;else outside++;}
   if(inBox)pixels.fill(0,i,i+4);
  }
  const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
  const result={width:bitmap.width,height:bitmap.height,inside,outside,outsideHash:await hash(pixels),pngHash:await hash(await blob.arrayBuffer())};
  bitmap.close();canvas.width=canvas.height=1;return result;
 },{url,region});
}
async function applySelection(current){
 await current.getByRole('button',{name:'在框内抠图',exact:true}).click();
 await current.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('局部抠图已应用'),{},{timeout:180000});
}

try{
 const desktop=await setup();page=desktop.current;
 const original=await page.getByAltText('sample.webp · 原图').evaluate(async img=>{await img.decode();return {width:img.naturalWidth,height:img.naturalHeight};});
 await page.getByRole('button',{name:'局部抠图',exact:true}).click();
 assert.equal(await page.locator('option[value="add"]').evaluate(option=>option.disabled),true);
 await fillRegion(page,{x:0,y:0,w:15,h:20});
 assert.equal(await page.getByRole('button',{name:'在框内抠图',exact:true}).isDisabled(),true);
 await fillRegion(page,{x:original.width-10,y:0,w:30,h:30});
 assert.equal(await page.getByRole('button',{name:'在框内抠图',exact:true}).isDisabled(),true);
 const surface=await page.getByLabel('局部抠图画布').boundingBox();
 await page.mouse.move(surface.x+surface.width*.27,surface.y+surface.height*.12);
 await page.mouse.down();
 await page.mouse.move(surface.x+surface.width*.76,surface.y+surface.height*.6,{steps:8});
 assert.equal(await page.getByRole('button',{name:'在框内抠图',exact:true}).isDisabled(),true);
 await page.mouse.up();
 const box=await regionFields(page);
 assert.ok(Math.abs(box.x-Math.floor(original.width*.27))<=1);
 assert.ok(Math.abs(box.y-Math.floor(original.height*.12))<=1);
 await page.screenshot({path:resolve(evidence,'desktop-selection.png'),fullPage:true});
 await applySelection(page);
 const first=await cutoutStats(page,box);
 assert.equal(first.width,original.width);assert.equal(first.height,original.height);
 assert.equal(first.outside,0);assert.ok(first.inside>100,'Real model must retain foreground in the chosen region');
 const product=await page.getByAltText('sample.webp · 交付商品图').evaluate(async img=>{await img.decode();return {width:img.naturalWidth,height:img.naturalHeight};});
 assert.deepEqual(product,{width:1200,height:1200});
 const review=page.getByRole('checkbox',{name:'确认图片 sample.webp'});
 await review.check();await page.waitForFunction(()=>document.querySelector('#saveStatus').textContent.startsWith('批次已保存'));
 assert.equal((await snapshot(page)).items[0].reviewedRevision,1);
 checks.real_region_replace={box,...first,product};

 // Cancel never starts inference or invalidates an already reviewed result.
 await page.getByRole('button',{name:'局部抠图',exact:true}).click();
 await page.keyboard.press('Escape');
 assert.equal(await review.isChecked(),true);
 assert.equal((await snapshot(page)).items[0].imageRevision,1);
 checks.cancel_preserves_review=true;

 const addBox={x:Math.floor(original.width*.2),y:Math.floor(original.height*.58),w:Math.floor(original.width*.65),h:Math.floor(original.height*.35)};
 const beforeAdd=await cutoutStats(page,addBox);
 await page.getByRole('button',{name:'局部抠图',exact:true}).click();
 await page.getByLabel('抠图方式').selectOption('add');await fillRegion(page,addBox);
 await applySelection(page);
 const afterAdd=await cutoutStats(page,addBox);
 assert.equal(afterAdd.outsideHash,beforeAdd.outsideHash,'Adding a region must not change any pixel outside that region');
 assert.ok(afterAdd.inside>beforeAdd.inside,'Second region should add foreground');
 assert.equal(await review.isChecked(),false);
 assert.equal((await snapshot(page)).items[0].imageRevision,2);
 assert.equal((await snapshot(page)).items[0].reviewedRevision,null);
 assert.equal(await page.locator('#exportBatch').isDisabled(),true);
 checks.real_region_add={addBox,before:beforeAdd,after:afterAdd};
 await review.check();await page.waitForFunction(()=>document.querySelector('#saveStatus').textContent.startsWith('批次已保存'));
 await page.reload();await page.waitForFunction(()=>document.querySelector('#saveStatus').textContent.startsWith('已恢复'));
 assert.equal(await review.isChecked(),true);
 assert.equal((await cutoutStats(page,addBox)).pngHash,afterAdd.pngHash);
 checks.refresh_restores_result_and_review=true;

 const downloadEvent=page.waitForEvent('download');await page.locator('#exportBatch').click();
 await (await downloadEvent).saveAs(resolve(evidence,'delivery.zip'));
 const manifest=JSON.parse(execFileSync('python3',['-c','import json,sys,zipfile\nz=zipfile.ZipFile(sys.argv[1])\nassert z.testzip() is None\nprint(z.read("delivery-manifest.json").decode())',resolve(evidence,'delivery.zip')],{encoding:'utf8'}));
 assert.equal(manifest.items[0].exported,true);
 assert.equal(manifest.items[0].imageRevision,2);assert.equal(manifest.items[0].reviewedRevision,2);
 checks.zip_crc_and_revision=manifest.items[0];
 await page.screenshot({path:resolve(evidence,'desktop-result.png'),fullPage:true});

 // Fresh worker after reload; abort model download to exercise failure recovery.
 await page.route('**/models/u2netp.onnx',route=>route.abort());
 await page.getByRole('button',{name:'局部抠图',exact:true}).click();await fillRegion(page,box);
 await page.getByRole('button',{name:'在框内抠图',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('局部抠图失败'),{},{timeout:180000});
 assert.equal(await review.isChecked(),true);
 assert.equal((await cutoutStats(page,addBox)).pngHash,afterAdd.pngHash);
 assert.equal((await snapshot(page)).items[0].imageRevision,2);
 checks.failed_inference_preserves_result_and_review=true;
 await page.unroute('**/models/u2netp.onnx');
 await page.locator('#clearBatch').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('批次已清空'));
 await page.locator('#files').setInputFiles({name:'sample.webp',mimeType:'image/webp',buffer:photo});
 await page.locator('#run').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('处理结束'),{},{timeout:180000});
 const whole=await cutoutStats(page,{x:0,y:0,w:original.width,h:original.height});
 assert.equal(whole.width,original.width);assert.equal(whole.height,original.height);assert.ok(whole.inside>100);
 checks.whole_image_inference_regression=whole;
 await desktop.context.close();

 const mobile=await setup({viewport:{width:375,height:812},isMobile:true,hasTouch:true});page=mobile.current;
 await page.getByRole('button',{name:'局部抠图',exact:true}).click();
 const touchSurface=await page.getByLabel('局部抠图画布').boundingBox();
 const cdp=await mobile.context.newCDPSession(page);
 const touch=async(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:x===undefined?[]:[{x,y}]});
 await touch('touchStart',touchSurface.x+touchSurface.width*.76,touchSurface.y+touchSurface.height*.6);
 await touch('touchMove',touchSurface.x+touchSurface.width*.27,touchSurface.y+touchSurface.height*.12);
 await touch('touchEnd');
 const mobileBox=await regionFields(page);
 assert.ok(Math.abs(mobileBox.x-box.x)<=1);assert.ok(Math.abs(mobileBox.y-box.y)<=1);
 assert.ok(Math.abs(mobileBox.w-box.w)<=2);assert.ok(Math.abs(mobileBox.h-box.h)<=2);
 assert.equal(await page.getByRole('button',{name:'在框内抠图',exact:true}).isEnabled(),true);
 await touch('touchStart',touchSurface.x+touchSurface.width*.1,touchSurface.y+touchSurface.height*.1);
 await touch('touchMove',touchSurface.x+touchSurface.width*.9,touchSurface.y+touchSurface.height*.9);
 await touch('touchCancel');
 assert.deepEqual(await regionFields(page),mobileBox);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile page must not overflow horizontally');
 const preview=await page.getByLabel('局部抠图画布').evaluate(canvas=>({width:canvas.width,height:canvas.height}));
 assert.ok(preview.width<=1200&&preview.height<=1200);
 await page.screenshot({path:resolve(evidence,'mobile-touch-selection.png'),fullPage:true});
 await applySelection(page);
 const mobileCutout=await cutoutStats(page,mobileBox);
 assert.equal(mobileCutout.outside,0);assert.ok(mobileCutout.inside>100);
 checks.mobile_emulated_touch_and_real_wasm={box:mobileBox,preview,...mobileCutout};

 // Keyboard selection uses original coordinates, not preview pixels.
 await page.getByRole('button',{name:'局部抠图',exact:true}).click();
 await page.getByRole('button',{name:'清除选区',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'在框内抠图',exact:true}).isDisabled(),true);
 await fillRegion(page,box);await page.locator('[data-coordinate="h"]').focus();
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('局部抠图已应用'),{},{timeout:180000});
 assert.equal((await snapshot(page)).items[0].imageRevision,2);
 checks.keyboard_original_coordinates=true;
 const boundaryError=await page.evaluate(()=>new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./worker.mjs?v=region-2',location.href),{type:'module'});
  const bitmap=new OffscreenCanvas(32,32).transferToImageBitmap();
  const timer=setTimeout(()=>{worker.terminate();reject(Error('Worker validation timed out'));},20000);
  worker.onmessage=({data})=>{clearTimeout(timer);worker.terminate();resolve(data.error);};
  worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(Error('Worker failed to load'));};
  worker.postMessage({id:1,bitmap,size:0,region:{x:20,y:0,w:20,h:20}},[bitmap]);
 }));
 assert.match(boundaryError,/选区/);checks.worker_rejects_out_of_bounds=boundaryError;
 await page.screenshot({path:resolve(evidence,'mobile-result.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 await writeFile(resolve(evidence,'acceptance.json'),JSON.stringify({passed:true,commit:process.env.GITHUB_SHA,checks,limitations:['Chromium mobile emulation, not physical Android','Existing repository image is a technical fixture, not an authorized commercial sample','No subjective edge-quality certification']},null,2));
 console.log('Region acceptance passed:',Object.keys(checks));
}catch(error){
 await page?.screenshot({path:resolve(evidence,'failure.png'),fullPage:true}).catch(()=>{});
 await writeFile(resolve(evidence,'acceptance.json'),JSON.stringify({passed:false,commit:process.env.GITHUB_SHA,checks,error:error.stack,errors},null,2));
 throw error;
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
