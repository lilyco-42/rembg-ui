import { test, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';

test('forms a complete brief without network uploads and invalidates an edited draft', async ({ page }) => {
  const writes = [];
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); });
  await page.goto('/product-images/');
  await page.getByLabel('这一批叫什么').fill('陶瓷新品');
  await page.getByLabel('还需要注意什么').fill('<img src=x onerror=alert(1)> 按 SKU 命名');
  await page.getByRole('button', { name: '生成需求单', exact: true }).click();
  await expect(page.locator('#brief-result')).toBeHidden();
  await page.getByLabel('我拥有或已获授权').check();
  await page.getByRole('button', { name: '生成需求单', exact: true }).click();
  await expect(page.locator('#brief-status')).toContainText('还未发送或下单');
  await expect(page.locator('#brief-text')).toHaveValue(/陶瓷新品[\s\S]*按 SKU 命名/);
  await expect(page.locator('#brief-result img')).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载需求单', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('商品图需求单.txt');
  expect(await readFile(await file.path(), 'utf8')).toContain('非订单');
  await page.getByLabel('原图数量').fill('11');
  await expect(page.locator('#brief-result')).toBeHidden();
  await expect(page.locator('#brief-status')).toContainText('重新生成');
  expect(writes).toEqual([]);
});

test('clipboard copies the current brief and has a visible blocked-copy fallback', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/product-images/');
  await page.getByLabel('我拥有或已获授权').check();
  await page.getByRole('button', { name: '生成需求单', exact: true }).click();
  await page.getByRole('button', { name: '复制需求单', exact: true }).click();
  await expect(page.locator('#brief-status')).toContainText('已复制');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('尚未发送');
  await context.clearPermissions();
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('blocked')) } }));
  await page.reload();
  await page.getByLabel('我拥有或已获授权').check();
  await page.getByRole('button', { name: '生成需求单', exact: true }).click();
  await page.getByRole('button', { name: '复制需求单', exact: true }).click();
  await expect(page.locator('#brief-status')).toContainText('已选中需求单');
});

test('guide downloads and drafts do not survive reload or leak to another browser context', async ({ page, browser }) => {
  await page.goto('/product-images/');
  await page.getByLabel('这一批叫什么').fill('private-customer-draft');
  await page.getByLabel('我拥有或已获授权').check();
  await page.getByRole('button', { name: '生成需求单', exact: true }).click();
  const second = await browser.newContext();
  const other = await second.newPage();
  await other.goto('http://127.0.0.1:8765/product-images/');
  await expect(other.locator('#brief-result')).toBeHidden();
  await expect(other.getByLabel('这一批叫什么')).toHaveValue('');
  await second.close();
  await page.reload();
  await expect(page.locator('#brief-result')).toBeHidden();
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: '下载规格说明' }).click();
  const guide = await download;
  expect(await readFile(await guide.path(), 'utf8')).toContain('1200 × 1200');
});

for (const width of [360, 390, 1280]) {
  test(`layout and theme at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/product-images/');
    await expect(page.getByRole('heading', { name: /下一批商品图/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByLabel('我拥有或已获授权').check();
    await page.getByRole('button', { name: '生成需求单', exact: true }).click();
    await expect(page.getByRole('button', { name: '复制需求单', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '切换深浅色', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await mkdir('screenshots', { recursive: true });
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `screenshots/product-images-${width}-dark.png`, fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: '切换深浅色', exact: true }).click();
    await expect.poll(() => page.locator('a[href="#brief"]').first().evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(32, 33, 35)');
    await page.screenshot({ path: `screenshots/product-images-${width}-light.png`, fullPage: true, animations: 'disabled' });
    await page.screenshot({ path: `screenshots/product-images-${width}-cover.png`, animations: 'disabled' });
    if (width < 860) {
      const menu = page.locator('.site-menu-button');
      await menu.click();
      await expect(page.locator('#site-sidebar a[href="/product-images/"]')).toBeVisible();
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Escape');
      await expect(menu).toHaveAttribute('aria-expanded', 'false');
    }
  });
}

test('homepage and purchase page expose the consultation without replacing existing purchase actions', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main a[href="/product-images/"]').first()).toBeVisible();
  await expect(page.locator('a[href="/compute/"]').first()).toBeVisible();
  await expect(page.locator('.site-nav [aria-current="page"]')).toHaveCount(1);
  const response = await page.request.get('/sub/buy.html');
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('/product-images/');
  expect(html).toContain('points/purchase');
  expect(html).toContain('id="orderCard"');
});

test('public consultation stays usable when browser storage is blocked', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get: () => { throw new Error('blocked'); } }));
  await page.goto('/product-images/');
  await expect(page.getByRole('button', { name: '切换深浅色', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '切换深浅色', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByLabel('我拥有或已获授权').check();
  await page.getByRole('button', { name: '生成需求单', exact: true }).click();
  await expect(page.locator('#brief-result')).toBeVisible();
});
