import { test, expect } from '@playwright/test';

test('全屏进入、系统退出和再次进入；断网可用', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.locator('.bottom-nav').getByRole('button', { name: '我的', exact: true }).click();
  await page.getByRole('button', { name: '进入全屏', exact: true }).click();
  await expect(page.getByText('当前显示：网页全屏', { exact: true })).toBeVisible();
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.getByRole('button', { name: '进入全屏', exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.getByRole('button', { name: '进入全屏', exact: true }).click();
  await page.getByRole('button', { name: '退出全屏', exact: true }).click();
  await expect(page.getByText('当前显示：浏览器窗口', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('不支持及拒绝全屏时给出准确提示', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: false });
    Object.defineProperty(document, 'webkitFullscreenEnabled', { configurable: true, value: false });
  });
  await page.goto('/');
  await page.locator('.bottom-nav').getByRole('button', { name: '我的', exact: true }).click();
  await expect(page.getByText('当前浏览器不支持网页全屏。可以尝试添加到主屏幕后打开。')).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
    document.documentElement.requestFullscreen = () => Promise.reject(new Error('denied'));
  });
  await page.locator('.bottom-nav').getByRole('button', { name: '首页', exact: true }).click();
  await page.locator('.bottom-nav').getByRole('button', { name: '我的', exact: true }).click();
  await page.getByRole('button', { name: '进入全屏', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('浏览器未允许全屏');
});
