import { test, expect, type Page } from "@playwright/test";
async function nav(p: Page, name: string) {
  await p
    .locator(".bottom-nav")
    .getByRole("button", { name, exact: true })
    .click();
}
async function demo(p: Page) {
  p.once("dialog", (d) => d.accept());
  await p.getByRole("button", { name: "加载演示数据", exact: true }).click();
  await expect(
    p.getByRole("heading", { name: "武功山 · 云上草甸" }),
  ).toBeVisible();
}
async function read(p: Page, store: string) {
  return p.evaluate(
    (store) =>
      new Promise<any[]>((resolve, reject) => {
        const r = indexedDB.open("shanxing");
        r.onsuccess = () => {
          const d = r.result;
          const q = d.transaction(store).objectStore(store).getAll();
          q.onsuccess = () => {
            resolve(q.result);
            d.close();
          };
          q.onerror = () => reject(q.error);
        };
        r.onerror = () => reject(r.error);
      }),
    store,
  );
}
test("购买入库防重、装备刷新持久化、备份照片恢复", async ({ page }) => {
  await page.goto("/");
  await nav(page, "待购");
  await page.getByRole("button", { name: "添加待购", exact: true }).click();
  await page.getByLabel("名称 *", { exact: true }).fill("测试登山杖");
  await page
    .getByLabel("分类", { exact: true })
    .selectOption({ label: "其他" });
  await page.getByLabel("预计价格（元）").fill("399.99");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "标记已购买" }).click();
  await page.getByRole("button", { name: "保存", exact: true }).dblclick();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav(page, "装备");
  await expect(page.getByRole("heading", { name: "测试登山杖" })).toBeVisible();
  await page.reload();
  await nav(page, "装备");
  expect((await read(page, "gear")).length).toBe(1);
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await page.getByLabel("本地照片").setInputFiles("public/icon-192.png");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav(page, "我的");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出完整备份" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  await nav(page, "装备");
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await page.getByLabel("装备名称").fill("临时更名");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("heading", { name: "临时更名" })).toBeVisible();
  await nav(page, "我的");
  page.once("dialog", (d) => d.accept());
  await page.locator("input[type=file]").setInputFiles(path!);
  await expect
    .poll(async () => (await read(page, "gear"))[0]?.name)
    .toBe("测试登山杖");
  expect((await read(page, "attachments"))[0].data).toMatch(
    /^data:image\/png;base64/,
  );
  expect((await read(page, "wishes"))[0].gearId).toBe(
    (await read(page, "gear"))[0].id,
  );
  await nav(page, "装备");
  await expect(page.getByRole("img", { name: "测试登山杖" })).toBeVisible();
});
test("演示数据、打包循环、复制重置和手机布局", async ({ page }) => {
  await page.goto("/");
  await demo(page);
  await page.screenshot({ path: ".tmp/mobile-home.png", fullPage: true });
  await page.getByRole("button", { name: "继续准备行程" }).click();
  await page.getByRole("button", { name: "打包", exact: true }).click();
  const target = page.getByRole("button", {
    name: "随身急救包：待准备，点击切换",
  });
  await target.click();
  await page
    .getByRole("button", { name: "随身急救包：已准备，点击切换" })
    .click();
  await expect(
    page.getByRole("button", { name: "随身急救包：已装包，点击切换" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "全部行程" }).click();
  await page.getByRole("button", { name: "复制行程" }).click();
  await expect(
    page.getByRole("heading", { name: "武功山 · 云上草甸 · 副本" }),
  ).toBeVisible();
  const trips = await read(page, "trips"),
    items = await read(page, "items");
  const copy = trips.find((t) => t.name.endsWith("副本"));
  expect(
    items
      .filter((i) => i.tripId === copy.id)
      .every((i) => i.state === "待准备"),
  ).toBe(true);
  expect(
    items.filter((i) => i.tripId !== copy.id && i.state === "已装包").length,
  ).toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("完成缓存后关闭页面断网重开，核心实体可增改删", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await demo(page);
  await nav(page, "我的");
  await expect
    .poll(async () =>
      page.evaluate(
        async () => !!(await navigator.serviceWorker.getRegistration())?.active,
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "检查离线使用条件" }).click();
  await expect(page.getByText("已就绪", { exact: true })).toBeVisible();
  await page.close();
  await context.setOffline(true);
  const p = await context.newPage();
  await p.goto("/");
  await expect(
    p.getByRole("heading", { name: "准备好，去山里。" }),
  ).toBeVisible();
  await nav(p, "装备");
  await p.getByRole("button", { name: "新增装备", exact: true }).click();
  await p.getByLabel("装备名称").fill("离线雨衣");
  await p.getByRole("button", { name: "保存", exact: true }).click();
  await expect(p.getByRole("heading", { name: "离线雨衣" })).toBeVisible();
  await nav(p, "行程");
  await p.getByRole("button", { name: "检查清单" }).click();
  await p.getByRole("button", { name: "临时物品", exact: true }).click();
  await p.getByLabel("物品名称").fill("离线气罐");
  await p.getByLabel("分类", { exact: true }).selectOption({ label: "炊具" });
  await p.getByRole("button", { name: "保存", exact: true }).click();
  await expect(p.getByRole("heading", { name: "离线气罐" })).toBeVisible();
  await p.getByRole("button", { name: "餐食", exact: true }).click();
  await p.getByRole("button", { name: "管理食物库" }).click();
  await p.getByRole("button", { name: "添加食物", exact: true }).click();
  await p.getByLabel("食物名称").fill("离线坚果");
  await p.getByRole("button", { name: "保存", exact: true }).click();
  await expect(p.getByRole("heading", { name: "离线坚果" })).toBeVisible();
  await p
    .getByRole("button", { name: "＋ 添加食物", exact: true })
    .first()
    .click();
  await p.getByLabel("食物", { exact: true }).selectOption({
    value: (await read(p, "foods"))
      .filter((f) => f.name === "离线坚果")
      .map((f) => `${f.name} · ${f.id}`)[0],
  });
  await p.getByRole("button", { name: "保存", exact: true }).click();
  await expect
    .poll(async () =>
      (await read(p, "meals")).some((m) => m.name === "离线坚果"),
    )
    .toBe(true);
  await p.getByRole("button", { name: "费用", exact: true }).click();
  await p.getByRole("button", { name: "记一笔" }).click();
  await p.getByLabel("实际金额（元）").fill("23.50");
  await p.getByLabel("备注", { exact: true }).fill("离线开销");
  await p.getByRole("button", { name: "保存", exact: true }).click();
  await expect(p.getByText(/离线开销/)).toBeVisible();
  await nav(p, "待购");
  await p.getByRole("button", { name: "添加待购", exact: true }).click();
  await p.getByLabel("名称 *", { exact: true }).fill("离线袜子");
  await p.getByLabel("分类", { exact: true }).selectOption({ label: "鞋袜" });
  await p.getByRole("button", { name: "保存", exact: true }).click();
  await expect(p.getByRole("heading", { name: "离线袜子" })).toBeVisible();
  await p.reload();
  await nav(p, "装备");
  const card = p
    .locator(".gear-card")
    .filter({ has: p.getByRole("heading", { name: "离线雨衣" }) });
  await card.getByRole("button", { name: "编辑", exact: true }).click();
  await p.getByLabel("单件重量").fill("130");
  await p.getByRole("button", { name: "保存", exact: true }).click();
  p.once("dialog", (d) => d.accept());
  await card.getByRole("button", { name: "移除", exact: true }).click();
  await expect(p.getByRole("heading", { name: "离线雨衣" })).toHaveCount(0);
  expect(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
test("空状态、非法输入和存储失败可见", async ({ page }) => {
  await page.goto("/");
  await nav(page, "装备");
  await expect(
    page.getByRole("heading", { name: "为下一次出发建立装备库" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "新增装备", exact: true })
    .first()
    .click();
  await page.getByLabel("装备名称").fill("不能负重");
  await page.getByLabel("单件重量").fill("-1");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  expect((await read(page, "gear")).length).toBe(0);
  await page.getByLabel("单件重量").fill("50");
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("测试：本机存储空间不足", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("本机存储空间不足");
  await expect(page.getByRole("dialog")).toBeVisible();
});
