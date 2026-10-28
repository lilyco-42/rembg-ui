import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Run public verification in GitHub Actions');
const require=createRequire(new URL('../site-resources/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const expected=JSON.parse(await readFile(new URL('../site-resources/site/downloads/manifest.json',import.meta.url),'utf8'));
const packages=JSON.parse(await readFile(new URL('../site-resources/packages.json',import.meta.url),'utf8'));
const checks=[];
await mkdir('live-resource-evidence',{recursive:true});
const response=await fetch('https://lain42.top/downloads/manifest.json',{cache:'no-store',signal:AbortSignal.timeout(30000)});
assert.equal(response.status,200);
assert.deepEqual(await response.json(),expected);
checks.push('public-catalog-equals-reviewed-126-item-manifest');
function headers(raw){
 const final=raw.split(/\r?\n\r?\n/).filter(block=>block.startsWith('HTTP/')).at(-1);
 assert.ok(final,'No HTTP response headers');
 const lines=final.split(/\r?\n/),status=Number(lines.shift().split(' ')[1]);
 return {status,fields:Object.fromEntries(lines.filter(line=>line.includes(':')).map(line=>{const p=line.indexOf(':');return[line.slice(0,p).toLowerCase(),line.slice(p+1).trim()]}))};
}
for(const file of packages){
 // Use curl's explicit HEAD handling: the site's HEAD has the GET size and no
 // body. Node 22's fetch rejected that response with a body-length mismatch.
 const rawHead=execFileSync('curl',['--fail','--silent','--show-error','--max-time','30','--head',file.url],{encoding:'utf8'});
 await writeFile(`live-resource-evidence/${file.id}-head.txt`,rawHead);
 const head=headers(rawHead);
 assert.equal(head.status,200);assert.equal(head.fields['content-length'],String(file.size));
 for(const [start,end] of [[0,65535],[file.size-65536,file.size-1]]){
  const headerFile=`live-resource-evidence/${file.id}-${start}-headers.txt`;
  const data=execFileSync('curl',['--fail','--silent','--show-error','--max-time','30','--max-filesize','65536','--range',`${start}-${end}`,'--dump-header',headerFile,file.url],{maxBuffer:131072});
  const part=headers(await readFile(headerFile,'utf8'));
  assert.equal(part.status,206);
  assert.equal(part.fields['content-range'],`bytes ${start}-${end}/${file.size}`);
  assert.equal(data.length,end-start+1);
  if(start===0)assert.ok(data.subarray(0,4).equals(Buffer.from([0x50,0x4b,0x03,0x04])));
  else assert.ok(data.includes(Buffer.from([0x50,0x4b,0x05,0x06])),'ZIP end record missing');
 }
 checks.push(file.id+'-public-head-and-first-last-64KiB');
}
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:390,height:900}});
 await page.goto('https://lain42.top/downloads/index.html?q=rembg');
 await page.locator('#software-rembg-studio-windows').waitFor({state:'visible'});
 assert.equal(await page.locator('.download-card').count(),1);
 await page.getByRole('link',{name:'批量抠图使用步骤 →'}).click();
 await page.getByRole('heading',{name:'如何批量抠图？'}).waitFor({state:'visible'});
 assert.equal(await page.locator('#rembg-download').getAttribute('href'),packages[0].url);
 assert.equal(await page.locator('ol li').count(),5);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'live-resource-evidence/rembg-guide-390.png',fullPage:true});
 checks.push('public-rembg-search-guide-link-five-steps-and-mobile-layout');
 await page.setViewportSize({width:1280,height:900});
 await page.goto('https://lain42.top/downloads/index.html?q=scrcpy');
 await page.locator('#software-scrcpy-windows').waitFor({state:'visible'});
 await page.locator('#software-android-platform-tools').waitFor({state:'visible'});
 assert.equal(await page.locator('#software-scrcpy-windows').getByRole('link',{name:'下载校验文件 →'}).getAttribute('href'),packages[1].url);
 await page.locator('#software-scrcpy-windows').scrollIntoViewIfNeeded();
 await page.screenshot({path:'live-resource-evidence/scrcpy-adb-1280.png'});
 checks.push('public-scrcpy-and-adb-entries-and-correct-download');
}finally{await browser.close()}
const proof={run:process.env.GITHUB_RUN_ID,source:process.env.GITHUB_SHA,checked_at:new Date().toISOString(),checks,
 scope:'Public browser workflow plus HEAD/first/last 64KiB. Full hosted files were SHA-256 checked on the server; this run does not redownload both full archives or test model quality/physical phone connection.'};
await writeFile('live-resource-evidence/RESULT.json',JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof,null,2));
