import { test, expect, type Page } from "@playwright/test";
async function nav(p: Page, name: string) {
  await p
    .locator(".bottom-nav")
    .getByRole("button", { name, exact: true })
    .click();
}
async function read(p: Page, store: string) {
  return p.evaluate(
    (store) =>
      new Promise<any[]>((resolve, reject) => {
        const r = indexedDB.open("shanxing");
        r.onsuccess = () => {
          const db = r.result;
          const q = db.transaction(store).objectStore(store).getAll();
          q.onsuccess = () => {
            resolve(q.result);
            db.close();
          };
          q.onerror = () => reject(q.error);
        };
      }),
    store,
  );
}
async function demo(p: Page) {
  await p.goto("/");
  p.once("dialog", (d) => d.accept());
  await p.getByRole("button", { name: "加载演示数据", exact: true }).click();
  await expect(
    p.getByRole("heading", { name: "武功山 · 云上草甸" }),
  ).toBeVisible();
}
async function packing(p: Page) {
  await nav(p, "行程");
  await p.getByRole("button", { name: "检查清单", exact: true }).click();
  await p.getByRole("button", { name: "打包", exact: true }).click();
}
test("手机模板直接编辑、临时来源去重、保留原状态与图标", async ({ page }) => {
  await demo(page);
  await nav(page, "我的");
  const row = page
    .locator(".list-row")
    .filter({
      has: page.getByRole("heading", { name: "单日轻装", exact: true }),
    });
  await row.getByRole("button", { name: "详情与编辑" }).click();
  await page.getByLabel("模板备注").fill("离线露营模板");
  await page.getByRole("button", { name: "新增临时物品", exact: true }).click();
  await page.getByLabel("物品名称").fill("稳定来源临时袋");
  await page
    .getByLabel("分类", { exact: true })
    .selectOption({ label: "其他" });
  await page.getByLabel("本人实际携带数量").fill("2");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "保存模板", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await packing(page);
  const before = await read(page, "items");
  await page.getByRole("button", { name: "使用模板", exact: true }).click();
  await page.getByLabel("选择模板").selectOption({ label: "单日轻装" });
  await expect(
    page.getByText("模板共 4 项，行程已有 3 项，本次只加入缺少的 1 项。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "确认加入缺少装备" }).click();
  await expect(page.getByText("清单已包含全部装备")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "确认加入缺少装备" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  expect((await read(page, "items")).length).toBe(before.length + 1);
  for (const i of before)
    expect((await read(page, "items")).find((x) => x.id === i.id)).toEqual(i);
  await expect(
    page.getByRole("heading", { name: "稳定来源临时袋" }),
  ).toBeVisible();
  await expect(
    page.locator(".pack-row").last().locator(".equipment-image"),
  ).toBeVisible();
  await page.screenshot({
    path: ".tmp/v11-packing-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("批量选择跨搜索分类保留；同步必须确认，进行中不显示入口", async ({
  page,
}) => {
  await demo(page);
  await nav(page, "行程");
  await page
    .getByRole("button", { name: "新建行程", exact: true })
    .first()
    .click();
  await page.getByLabel("行程名称").fill("多选验收");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "打包", exact: true }).click();
  await page.getByRole("button", { name: "从装备库添加", exact: true }).click();
  await page.getByLabel("搜索可选装备").fill("背包");
  await page.getByLabel("选择装备 轻量徒步背包 45L", { exact: true }).check();
  await page.getByLabel("搜索可选装备").fill("");
  await page.getByLabel("选择器分类筛选").selectOption({ label: "睡眠" });
  await page.getByRole("button", { name: "全选当前筛选结果" }).click();
  await expect(page.getByText("已选 3 件")).toBeVisible();
  await page.getByLabel("选择器分类筛选").selectOption({ label: "全部分类" });
  await expect(
    page.getByLabel("选择装备 轻量徒步背包 45L", { exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "添加所选", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const trips = await read(page, "trips");
  const trip = trips.find((t) => t.name === "多选验收");
  const before = (await read(page, "items")).filter(
    (i) => i.tripId === trip.id,
  );
  expect(before).toHaveLength(3);
  await nav(page, "装备");
  await page
    .locator(".gear-card")
    .filter({ has: page.getByRole("heading", { name: "轻量徒步背包 45L" }) })
    .getByRole("button", { name: "编辑", exact: true })
    .click();
  await page.getByLabel("单件重量").fill("777");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav(page, "行程");
  await page.getByRole("button", { name: "打包", exact: true }).click();
  await page.getByRole("button", { name: "查看并同步", exact: true }).click();
  await expect(page.getByText("1100 → 777")).toBeVisible();
  expect(
    (await read(page, "items")).find(
      (i) => i.id === before.find((i) => i.name.includes("背包")).id,
    ).weight,
  ).toBe(1100);
  await page.getByLabel("同步 单件重量（克） 1100").check();
  await page.getByRole("button", { name: "确认同步 1 项变更" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    (await read(page, "items")).find(
      (i) => i.id === before.find((i) => i.name.includes("背包")).id,
    ).weight,
  ).toBe(777);
  await page.getByRole("button", { name: "编辑行程", exact: true }).click();
  await page.getByLabel("行程状态").selectOption("进行中");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "查看并同步", exact: true }),
  ).toHaveCount(0);
});
test("直接装包、连续撤销与筛选批量撤销后刷新状态一致", async ({ page }) => {
  await demo(page);
  await packing(page);
  const before = await read(page, "items");
  await page
    .getByRole("button", { name: "装包 随身急救包", exact: true })
    .click();
  await page
    .getByRole("button", { name: "装包 钛合金炊具", exact: true })
    .click();
  await page
    .getByRole("button", { name: "撤销装包 随身急救包", exact: true })
    .click();
  expect(
    (await read(page, "items")).find((i) => i.name === "随身急救包").state,
  ).toBe("待准备");
  expect(
    (await read(page, "items")).find((i) => i.name === "钛合金炊具").state,
  ).toBe("已装包");
  await page
    .getByRole("button", { name: "撤销装包 钛合金炊具", exact: true })
    .click();
  await page.getByLabel("打包分类").selectOption("服装");
  page.once("dialog", (d) => {
    expect(d.message()).toContain("当前筛选结果中 1 项");
    return d.accept();
  });
  await page.getByRole("button", { name: "全部装包（当前筛选 1 项）" }).click();
  await page
    .getByRole("button", { name: "撤销装包 防水冲锋衣", exact: true })
    .click();
  expect((await read(page, "items")).map((i) => [i.id, i.state])).toEqual(
    before.map((i) => [i.id, i.state]),
  );
  await page.reload();
  await packing(page);
  expect((await read(page, "items")).map((i) => [i.id, i.state])).toEqual(
    before.map((i) => [i.id, i.state]),
  );
});
test("分类管理返回保留草稿，离线图标回退、版本提示与备份计数", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await nav(page, "我的");
  await expect(page.getByTestId("app-version")).toHaveText("1.1.0");
  await page.getByLabel("备份提醒阈值").fill("1");
  await page.getByRole("button", { name: "保存提醒设置" }).click();
  await nav(page, "装备");
  await page
    .getByRole("button", { name: "新增装备", exact: true })
    .first()
    .click();
  await page.getByLabel("装备名称").fill("保留的草稿");
  await page.getByLabel("单件重量").fill("150");
  await page.getByRole("button", { name: "管理分类", exact: true }).click();
  const manager = page.getByRole("dialog", { name: "分类管理", exact: true });
  await manager.getByRole("button", { name: "新增分类", exact: true }).click();
  await manager.getByLabel("分类名称", { exact: true }).fill("摄影");
  await manager.getByLabel("内置图标").selectOption("电子设备");
  await manager.getByRole("button", { name: "保存分类", exact: true }).click();
  await manager.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(page.getByLabel("装备名称")).toHaveValue("保留的草稿");
  await expect(page.getByLabel("单件重量")).toHaveValue("150");
  await page
    .getByLabel("分类", { exact: true })
    .selectOption({ label: "摄影" });
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.locator('.equipment-image[data-fallback="true"]').first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "立即备份", exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "立即备份", exact: true }).click();
  await download;
  await nav(page, "我的");
  await expect(page.getByTestId("change-count")).toHaveText("0 次");
  await page.getByRole("button", { name: "检查离线使用条件" }).click();
  await expect(page.getByText("已就绪", { exact: true })).toBeVisible();
  await page.close();
  await context.setOffline(true);
  const p = await context.newPage();
  await p.goto("/");
  await nav(p, "我的");
  await p.getByRole("button", { name: "检查更新", exact: true }).click();
  await expect(
    p.getByText("当前离线，暂时无法检查更新。", { exact: true }),
  ).toBeVisible();
  await nav(p, "装备");
  await expect(p.getByRole("heading", { name: "保留的草稿" })).toBeVisible();
  await expect(
    p.getByRole("img", { name: "保留的草稿 · 电子设备图标" }),
  ).toBeVisible();
  expect(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
