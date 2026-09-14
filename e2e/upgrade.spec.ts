import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, extname } from "node:path";
test("真实 1.0 资源升级到 1.1：旧数据照片快照保留，主动更新实际构建且保护草稿", async ({
  browser,
}) => {
  test.setTimeout(120000);
  test.skip(
    !existsSync(".tmp/upgrade-v1-dist/index.html") ||
      !existsSync(".tmp/upgrade-next-dist/index.html"),
    "运行 docs/UPGRADE-TEST.md 中的旧版本资源准备步骤后再执行升级验收",
  );
  let root = resolve(".tmp/upgrade-v1-dist");
  const types: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
  };
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url!, "http://localhost").pathname,
      );
      const file = resolve(
        root,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (!file.startsWith(root)) {
        res.writeHead(403).end();
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type": types[extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  const url = `http://127.0.0.1:${port}/`;
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  try {
    let p = await ctx.newPage();
    await p.goto(url);
    p.once("dialog", (d) => d.accept());
    await p.getByRole("button", { name: "加载演示数据", exact: true }).click();
    await expect(
      p.getByRole("heading", { name: "武功山 · 云上草甸" }),
    ).toBeVisible();
    await p
      .locator(".bottom-nav")
      .getByRole("button", { name: "装备", exact: true })
      .click();
    await p
      .locator(".gear-card")
      .first()
      .getByRole("button", { name: "编辑", exact: true })
      .click();
    await p.getByLabel("本地照片").setInputFiles("public/icon-192.png");
    await p.getByRole("button", { name: "保存", exact: true }).click();
    await expect(p.getByRole("dialog")).toHaveCount(0);
    const old = await p.evaluate(
      () =>
        new Promise<any>((resolve, reject) => {
          const r = indexedDB.open("shanxing");
          r.onsuccess = () => {
            const d = r.result;
            const tx = d.transaction([
              "gear",
              "items",
              "templates",
              "attachments",
            ]);
            const result: any = { version: d.version };
            for (const name of ["gear", "items", "templates", "attachments"]) {
              const q = tx.objectStore(name).getAll();
              q.onsuccess = () => (result[name] = q.result);
            }
            tx.oncomplete = () => {
              d.close();
              resolve(result);
            };
          };
        }),
    );
    expect(old.version).toBe(20);
    await p.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await p.reload();
    await expect
      .poll(() => p.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true);
    root = resolve("dist");
    await p.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())!.update();
    });
    await expect
      .poll(() =>
        p.evaluate(
          async () =>
            !!(await navigator.serviceWorker.getRegistration())?.waiting,
        ),
      )
      .toBe(true);
    await p.close();
    p = await ctx.newPage();
    await p.goto(url);
    await p
      .locator(".bottom-nav")
      .getByRole("button", { name: "我的", exact: true })
      .click();
    await expect(p.getByTestId("app-version")).toHaveText("1.1.1");
    const migrated = await p.evaluate(
      () =>
        new Promise<any>((resolve) => {
          const r = indexedDB.open("shanxing");
          r.onsuccess = () => {
            const d = r.result;
            const tx = d.transaction([
              "gear",
              "items",
              "templates",
              "attachments",
              "categories",
            ]);
            const result: any = { version: d.version };
            for (const name of [
              "gear",
              "items",
              "templates",
              "attachments",
              "categories",
            ]) {
              const q = tx.objectStore(name).getAll();
              q.onsuccess = () => (result[name] = q.result);
            }
            tx.oncomplete = () => {
              d.close();
              resolve(result);
            };
          };
        }),
    );
    expect(migrated.version).toBe(30);
    expect(migrated.gear.length).toBe(old.gear.length);
    expect(migrated.attachments).toEqual(old.attachments);
    for (const i of old.items)
      expect(migrated.items.find((n: any) => n.id === i.id)).toMatchObject(i);
    expect(migrated.templates[0].items[0].sourceId).toBeTruthy();
    expect(migrated.categories.length).toBeGreaterThan(13);
    root = resolve(".tmp/upgrade-next-dist");
    await p.getByRole("button", { name: "检查更新", exact: true }).click();
    await expect(
      p
        .getByRole("button", { name: "发现新版本，更新并重启", exact: true })
        .first(),
    ).toBeVisible();
    const before = await p.locator(".version-build").innerText();
    await p.getByRole("button", { name: "新建模板", exact: true }).click();
    await p.getByLabel("模板名称").fill("不要丢失的草稿");
    p.once("dialog", (d) => {
      expect(d.message()).toContain("未保存编辑");
      return d.accept();
    });
    await p
      .getByRole("button", { name: "发现新版本，更新并重启", exact: true })
      .first()
      .evaluate((b: HTMLButtonElement) => b.click());
    await expect(p.getByLabel("模板名称")).toHaveValue("不要丢失的草稿");
    await p.getByRole("button", { name: "保存模板", exact: true }).click();
    await expect(p.getByRole("dialog")).toHaveCount(0);
    await Promise.all([
      p.waitForEvent("load"),
      p
        .getByRole("button", { name: "发现新版本，更新并重启", exact: true })
        .first()
        .click(),
    ]);
    await p
      .locator(".bottom-nav")
      .getByRole("button", { name: "我的", exact: true })
      .click();
    await expect(p.locator(".version-build")).toContainText("v11-update-c");
    expect(await p.locator(".version-build").innerText()).not.toBe(before);
    await expect(
      p.getByRole("heading", { name: "不要丢失的草稿" }),
    ).toBeVisible();
    await p.close();
    await ctx.setOffline(true);
    p = await ctx.newPage();
    await p.goto(url);
    await p
      .locator(".bottom-nav")
      .getByRole("button", { name: "装备", exact: true })
      .click();
    await expect(p.locator(".gear-card")).toHaveCount(old.gear.length);
    await expect(p.locator(".gear-card img")).toHaveCount(1);
  } finally {
    await ctx.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
