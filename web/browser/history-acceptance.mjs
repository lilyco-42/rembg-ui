// Product acceptance runs only in GitHub Actions, against the built website.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const dist=fileURLToPath(new URL('../dist/',import.meta.url));
const evidence=fileURLToPath(new URL('../browser-results/',import.meta.url));
await mkdir(evidence,{recursive:true});
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const target=resolve(dist,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!target.startsWith(resolve(dist)+sep))throw Error('Invalid path');
  const bytes=await readFile(target);
  const type=target.endsWith('.wasm')?'application/wasm':/\.m?js$/.test(target)?'text/javascript':target.endsWith('.html')?'text/html':'application/octet-stream';
  res.writeHead(200,{'Content-Type':type});res.end(bytes);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(8057,'127.0.0.1',resolve));
const browser=await chromium.launch(),checks={},errors=[];
const photo=await readFile(new URL('../../test/778c75fc182f4ca939a220bd4954f4b8.webp',import.meta.url));
let page;
const files=names=>names.map(name=>({name,mimeType:'image/webp',buffer:photo}));
async function settled(){await page.waitForFunction(()=>!document.querySelector('#files').disabled&&document.querySelector('#saveStatus').textContent.startsWith('批次已保存'));}
async function project(){
 return page.evaluate(async()=>{
  const {openProjectStore}=await import('./project-store.mjs?v=region-2');
  const snapshot=await (await openProjectStore()).load();
  return Promise.all(snapshot.items.map(async item=>({source:item.source,status:item.status,imageRevision:item.imageRevision,reviewedRevision:item.reviewedRevision,reviewed:item.reviewed,
   png:item.output?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await item.output.transparent.arrayBuffer())),byte=>byte.toString(16).padStart(2,'0')).join(''):null})));
 });
}
async function restored(){await page.reload();await page.waitForFunction(()=>!document.querySelector('#files').disabled&&document.querySelector('#saveStatus').textContent.startsWith('已恢复'));}
async function setup(options={}){
 const context=await browser.newContext({serviceWorkers:'block',...options});
 page=await context.newPage();page.setDefaultTimeout(20000);
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:8057/');await page.waitForFunction(()=>!document.querySelector('#files').disabled);
 return context;
}
try{
 const desktop=await setup();
 await page.locator('#files').setInputFiles(files(['keep.webp','delete.webp','pending.webp']));await settled();
 assert.equal(await page.locator('.result-card').count(),3);
 assert.equal(await page.locator('.result-body:visible').count(),1);
 await page.getByRole('button',{name:'局部抠图',exact:true}).click();
 for(const [key,value]of Object.entries({x:229,y:130,w:417,h:523}))await page.locator(`[data-coordinate="${key}"]`).fill(String(value));
 await page.locator('[data-coordinate="h"]').blur();
 await page.getByRole('button',{name:'在框内抠图',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('#files').disabled&&document.querySelector('#status').textContent.startsWith('局部抠图已应用'),{},{timeout:180000});
 await page.getByRole('checkbox',{name:'确认图片 keep.webp'}).check();await settled();
 const before=await project();
 // A failed IndexedDB write must roll back both the visible list and saved list.
 await page.evaluate(()=>{
  const put=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(...args){IDBObjectStore.prototype.put=put;throw new DOMException('Injected write failure','QuotaExceededError');};
 });
 await page.getByRole('button',{name:'删除图片 delete.webp',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('删除未能保存'));
 assert.equal(await page.locator('.result-card').count(),3);assert.deepEqual(await project(),before);
 checks.failed_delete_rolls_back=true;
 await page.getByRole('button',{name:'删除图片 delete.webp',exact:true}).click();await settled();
 const remaining=await project();assert.deepEqual(remaining.map(item=>item.source),['keep.webp','pending.webp']);assert.deepEqual(remaining[0],before[0]);
 await restored();assert.deepEqual(await project(),remaining);
 assert.equal(await page.getByRole('checkbox',{name:'确认图片 keep.webp'}).isChecked(),true);
 checks.delete_pending_persists_and_preserves_reviewed_result=true;
 const download=page.waitForEvent('download');await page.locator('#exportBatch').click();await(await download).saveAs(resolve(evidence,'history-delivery.zip'));
 const manifest=JSON.parse(execFileSync('python3',['-c','import sys,zipfile\nz=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None\nprint(z.read("delivery-manifest.json").decode())',resolve(evidence,'history-delivery.zip')],{encoding:'utf8'}));
 assert.deepEqual(manifest.items.map(item=>item.source),['keep.webp','pending.webp']);assert.equal(manifest.items[0].exported,true);assert.equal(manifest.items[1].exported,false);
 checks.deleted_item_excluded_from_delivery=true;
 await page.getByRole('button',{name:'删除图片 keep.webp',exact:true}).click();await settled();
 assert.deepEqual((await project()).map(item=>item.source),['pending.webp']);assert.equal(await page.locator('#exportBatch').isDisabled(),true);
 await page.locator('#clearHistory').click();await settled();assert.deepEqual(await project(),[]);
 await restored();assert.equal(await page.locator('.result-card').count(),0);assert.equal(await page.locator('#size').isEnabled(),true);assert.equal(await page.locator('#clearHistory').isDisabled(),true);
 checks.delete_completed_and_clear_all_survive_refresh=true;
 await page.locator('#files').setInputFiles(files(Array.from({length:10},(_,i)=>`${String(i).padStart(2,'0')}.webp`)));await settled();
 assert.equal(await page.locator('.result-card').count(),10);assert.equal(await page.locator('.result-body:visible').count(),1);
 assert.ok(await page.locator('#results').evaluate(el=>el.clientHeight<=innerHeight*.7+2&&el.scrollHeight>el.clientHeight));
 await page.locator('#collapseHistory').click();assert.equal(await page.locator('.result-body:visible').count(),0);
 await page.locator('.result-toggle').filter({hasText:'08.webp'}).click();assert.equal(await page.locator('.result-body:visible').count(),1);await page.getByAltText('08.webp · 原图').waitFor();
 await page.screenshot({path:resolve(evidence,'history-desktop.png'),fullPage:true});checks.ten_records_have_bounded_list_and_one_preview=true;
 await desktop.close();
 const mobile=await setup({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
 await page.locator('#files').setInputFiles(files(Array.from({length:10},(_,i)=>`mobile-${i}.webp`)));await settled();
 await page.locator('#collapseHistory').click();assert.equal(await page.locator('.result-body:visible').count(),0);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await page.locator('#results').evaluate(el=>el.clientHeight<=innerHeight*.7+2));
 await page.getByRole('button',{name:'删除图片 mobile-2.webp',exact:true}).click();await settled();await restored();
 assert.equal(await page.locator('.result-card').count(),9);assert.ok(!(await project()).some(item=>item.source==='mobile-2.webp'));
 await page.locator('#collapseHistory').click();await page.screenshot({path:resolve(evidence,'history-mobile.png'),fullPage:true});
 await page.locator('#clearHistory').click();await settled();await restored();assert.equal(await page.locator('.result-card').count(),0);
 await mobile.close();checks.mobile_delete_clear_and_compact_layout=true;
 assert.deepEqual(errors,[]);
 await writeFile(resolve(evidence,'history-acceptance.json'),JSON.stringify({passed:true,commit:process.env.GITHUB_SHA,checks,limitations:['Mobile Chromium emulation, not physical Android','Technical repository fixture, not a commercial sample']},null,2));
 console.log('History deletion and compact layout acceptance passed.');
}catch(error){
 await page?.screenshot({path:resolve(evidence,'history-failure.png'),fullPage:true}).catch(()=>{});
 await writeFile(resolve(evidence,'history-acceptance.json'),JSON.stringify({passed:false,commit:process.env.GITHUB_SHA,checks,error:error.stack,errors},null,2));throw error;
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
