import { test, expect, chromium } from "@playwright/test";
import { mkdtemp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
test("退出整个浏览器后，使用持久配置断网冷启动并保存", async () => {
  await mkdir(".tmp", { recursive: true });
  const profile = await mkdtemp(resolve(".tmp/cold-profile-"));
  const options = {
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    viewport: { width: 390, height: 844 },
  };
  let context = await chromium.launchPersistentContext(profile, options);
  try {
    let p = context.pages()[0];
    await p.goto("http://localhost:4173");
    await p
      .locator(".bottom-nav")
      .getByRole("button", { name: "装备", exact: true })
      .click();
    await p
      .getByRole("button", { name: "新增装备", exact: true })
      .first()
      .click();
    await p.getByLabel("装备名称").fill("冷启动保留的背包");
    await p.getByLabel("本地照片").setInputFiles("public/icon-192.png");
    await p.getByRole("button", { name: "保存", exact: true }).click();
    await expect(
      p.getByRole("heading", { name: "冷启动保留的背包" }),
    ).toBeVisible();
    await p
      .locator(".bottom-nav")
      .getByRole("button", { name: "我的", exact: true })
      .click();
    await expect
      .poll(async () =>
        p.evaluate(
          async () =>
            !!(await navigator.serviceWorker.getRegistration())?.active,
        ),
      )
      .toBe(true);
    await p.getByRole("button", { name: "检查离线使用条件" }).click();
    await expect(p.getByText("已就绪", { exact: true })).toBeVisible();
    await context.close();
    context = await chromium.launchPersistentContext(profile, {
      ...options,
      offline: true,
    });
    p = context.pages()[0];
    await p.goto("http://localhost:4173");
    await expect(p.getByText("离线", { exact: true })).toBeVisible();
    await p
      .locator(".bottom-nav")
      .getByRole("button", { name: "装备", exact: true })
      .click();
    await expect(
      p.getByRole("heading", { name: "冷启动保留的背包" }),
    ).toBeVisible();
    await expect(
      p.getByRole("img", { name: "冷启动保留的背包" }),
    ).toBeVisible();
    await p.getByRole("button", { name: "编辑", exact: true }).click();
    await p.getByLabel("单件重量").fill("765");
    await p.getByRole("button", { name: "保存", exact: true }).click();
    await expect(p.getByRole("dialog")).toHaveCount(0);
    await p.reload();
    await p
      .locator(".bottom-nav")
      .getByRole("button", { name: "装备", exact: true })
      .click();
    await expect(p.locator(".gear-metrics")).toContainText("765");
  } finally {
    await context.close();
  }
});
test("桌面导航、餐食与设备宽度无溢出", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.goto("/");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "加载演示数据", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "武功山 · 云上草甸" }),
  ).toBeVisible();
  await page.screenshot({ path: ".tmp/desktop-home.png", fullPage: true });
  for (const name of ["装备", "行程", "待购", "我的"]) {
    await page
      .locator(".sidebar")
      .getByRole("button", { name, exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
