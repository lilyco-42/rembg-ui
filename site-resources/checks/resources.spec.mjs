import { test, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
const original = JSON.parse(await readFile(new URL('../baseline-manifest.json',import.meta.url),'utf8'));

test('catalog retains existing resources and provides the verified downloads and official ADB entry', async ({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/downloads/index.html');
 await expect(page.locator('.download-card')).toHaveCount(original.items.length+3);
 const response=await page.request.get('/downloads/manifest.json'),catalog=await response.json();
 expect(catalog.items.slice(3)).toEqual(original.items);
 for(const id of ['rembg-studio-windows','scrcpy-windows']){
  const card=page.locator('#software-'+id), item=catalog.items.find(x=>x.id===id);
  await expect(card.getByRole('link',{name:'下载校验文件 →'})).toHaveAttribute('href',item.mirror.url);
  await expect(card).toContainText(item.mirror.sha256);
  await expect(card).toContainText('本站文件');
 }
 await expect(page.locator('#software-android-platform-tools').getByRole('link',{name:'前往官网下载 / 安装 ↗'})).toHaveAttribute('href','https://developer.android.com/tools/releases/platform-tools');
 expect(errors).toEqual([]);
});

test('comment-ready link opens the correct search and OS/category filters remain usable',async({page})=>{
 await page.goto('/downloads/index.html?q=rembg&platform=windows');
 await expect(page.locator('.download-card')).toHaveCount(1);
 await expect(page.locator('#software-rembg-studio-windows')).toBeVisible();
 await page.getByRole('link',{name:'批量抠图使用步骤 →'}).click();
 await expect(page).toHaveURL(/\/downloads\/rembg\/index.html$/);
 await expect(page.getByRole('heading',{name:'如何批量抠图？'})).toBeVisible();
 await page.goto('/downloads/index.html?q=scrcpy');
 await expect(page.locator('#software-scrcpy-windows')).toBeVisible();
 await expect(page.locator('#software-android-platform-tools')).toBeVisible();
 await page.getByRole('button',{name:/^macOS/}).click();
 await expect(page.locator('#software-scrcpy-windows')).toHaveCount(0);
 await expect(page.locator('#software-android-platform-tools')).toBeVisible();
 await page.getByLabel('搜索软件',{exact:true}).fill('a resource that does not exist');
 await expect(page.locator('#download-grid')).toContainText('该筛选下没有软件');
});

for(const width of [360,390,1280]){
 test(`guide and filtered resources stay readable in both themes at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  for(const [name,url] of [['catalog','/downloads/index.html?q=rembg'],['guide','/downloads/rembg/index.html']]){
   await page.goto(url);
   if(name==='catalog')await expect(page.locator('.download-card')).toHaveCount(1);
   else await expect(page.locator('ol li')).toHaveCount(5);
   if(await page.locator('html').getAttribute('data-theme')!=='light')await page.getByRole('button',{name:'切换深浅色',exact:true}).click();
   for(const theme of ['light','dark']){
    if(theme==='dark')await page.getByRole('button',{name:'切换深浅色',exact:true}).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await mkdir('screenshots',{recursive:true});
    await page.screenshot({path:`screenshots/resources-${name}-${width}-${theme}.png`,fullPage:true,animations:'disabled'});
   }
  }
 });
}

test('download failure has a visible official alternative and manifest failure is understandable',async({page})=>{
 await page.goto('/downloads/rembg/index.html');
 await expect(page.locator('#rembg-download')).toHaveAttribute('href',/\/Rembg-UI-windows\.zip$/);
 await expect(page.getByRole('link',{name:'官方最新版本 / 更新记录 ↗'})).toHaveAttribute('href','https://github.com/lilyco-42/rembg-ui/releases/latest');
 await page.route('**/downloads/manifest.json',route=>route.fulfill({status:503,body:'unavailable'}));
 await page.goto('/downloads/index.html');
 await expect(page.locator('#download-grid')).toContainText('目录暂时不可用');
 await expect(page.getByRole('link',{name:'批量抠图下载与教程 →'})).toBeVisible();
});
