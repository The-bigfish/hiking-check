import { chromium, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

const url = 'https://hiking-check.rweb.site/#/';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (process.platform === 'win32' && existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
const browser = await chromium.launch({headless:true, executablePath,
  ...(process.env.HTTPS_PROXY ? {proxy:{server:process.env.HTTPS_PROXY}} : {})});
const context = await browser.newContext({viewport:{width:390,height:844}});
const errors = [];
try {
  let page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url, {waitUntil:'networkidle', timeout:60000});
  await expect(page).toHaveTitle(/山行清单/);
  await page.locator('.bottom-nav').getByRole('button',{name:'我的',exact:true}).click();
  await expect(page.getByTestId('app-version')).toHaveText('1.1.2');
  await expect.poll(async()=>page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration())?.active),{timeout:30000}).toBe(true);
  await page.getByRole('button',{name:'检查离线使用条件'}).click();
  await expect(page.getByText('已就绪',{exact:true})).toBeVisible();
  await page.close();
  await context.setOffline(true);
  page = await context.newPage();
  await page.goto(url);
  await expect(page.getByRole('heading',{name:'准备好，去山里。'})).toBeVisible();
  await page.locator('.bottom-nav').getByRole('button',{name:'装备',exact:true}).click();
  await page.getByRole('button',{name:'新增装备',exact:true}).first().click();
  await page.getByLabel('装备名称').fill('线上离线验收装备（隔离浏览器）');
  await page.getByRole('button',{name:'保存',exact:true}).click();
  await expect(page.getByRole('heading',{name:'线上离线验收装备（隔离浏览器）'})).toBeVisible();
  await page.reload();
  await page.locator('.bottom-nav').getByRole('button',{name:'装备',exact:true}).click();
  await expect(page.getByRole('heading',{name:'线上离线验收装备（隔离浏览器）'})).toBeVisible();
  await mkdir('.tmp',{recursive:true});
  await page.screenshot({path:'.tmp/deployed-mobile.png',fullPage:true});
  expect(errors).toEqual([]);
  console.log(JSON.stringify({url,onlineLoad:true,offlineReady:true,offlineReopen:true,offlineSaveAndReload:true,pageErrors:errors}));
} finally { await browser.close(); }
