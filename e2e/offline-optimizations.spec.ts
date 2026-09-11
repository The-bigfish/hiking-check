import { test, expect } from "@playwright/test";
test("断网重开后多选、模板编辑套用、同步、分类和装包撤销全流程可用", async ({
  page,
  context,
}) => {
  await page.goto("/");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "加载演示数据", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "武功山 · 云上草甸" }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.close();
  await context.setOffline(true);
  const p = await context.newPage();
  await p.goto("/");
  const nav = async (name: string) =>
    p.locator(".bottom-nav").getByRole("button", { name, exact: true }).click();
  await nav("我的");
  await p.getByRole("button", { name: "新建模板" }).click();
  await p.getByLabel("模板名称").fill("无网模板");
  await p.getByRole("button", { name: "新增库中装备" }).click();
  await p.getByLabel("搜索可选装备").fill("头灯");
  await p.getByRole("button", { name: "全选当前筛选结果" }).click();
  await p.getByRole("button", { name: "添加所选", exact: true }).click();
  await p.getByRole("button", { name: "保存模板", exact: true }).click();
  await expect(p.getByRole("heading", { name: "无网模板" })).toBeVisible();
  await p.getByRole("button", { name: "管理分类", exact: true }).click();
  await p.getByRole("button", { name: "新增分类" }).click();
  await p.getByLabel("分类名称").fill("离线类别");
  await p.getByLabel("内置图标").selectOption("照明");
  await p.getByRole("button", { name: "保存分类" }).click();
  await p.getByRole("button", { name: "关闭", exact: true }).click();
  await nav("装备");
  await p
    .locator(".gear-card")
    .filter({ has: p.getByRole("heading", { name: "头灯与备用电池" }) })
    .getByRole("button", { name: "编辑", exact: true })
    .click();
  await p
    .getByLabel("分类", { exact: true })
    .selectOption({ label: "离线类别" });
  await p.getByLabel("单件重量").fill("101");
  await p.getByRole("button", { name: "保存", exact: true }).click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
  await nav("行程");
  await p.getByRole("button", { name: "检查清单", exact: true }).click();
  await p.getByRole("button", { name: "查看并同步", exact: true }).click();
  await p.getByLabel("同步 单件重量（克） 95").check();
  await p.getByLabel("同步 分类 照明").check();
  await p.getByRole("button", { name: "确认同步 2 项变更" }).click();
  await expect(p.getByRole("dialog")).toHaveCount(0);
  await p.getByRole("button", { name: "使用模板" }).click();
  await p.getByLabel("选择模板").selectOption({ label: "无网模板" });
  await expect(p.getByText("清单已包含全部装备")).toBeVisible();
  await p.getByRole("button", { name: "关闭", exact: true }).click();
  await p
    .getByRole("button", { name: "装包 头灯与备用电池", exact: true })
    .click();
  await p
    .getByRole("button", { name: "撤销装包 头灯与备用电池", exact: true })
    .click();
  // Wait for the committed state before simulating a subsequent reopen.
  await expect(p.getByRole("button", { name: "头灯与备用电池：已准备，点击切换" })).toBeVisible();
  await p.reload();
  await nav("行程");
  await p.getByRole("button", { name: "检查清单", exact: true }).click();
  const row = p
    .locator(".pack-row")
    .filter({ has: p.getByRole("heading", { name: "头灯与备用电池" }) });
  await expect(row).toContainText("101 g");
  await expect(row).toContainText("已准备");
  await expect(row).toContainText("离线类别");
  await expect(
    row.locator('.equipment-image[data-fallback="true"]'),
  ).toBeVisible();
  await row.getByRole("button", { name: "编辑", exact: true }).click();
  await p.screenshot({ path: ".tmp/v11-offline-form.png", fullPage: false });
  expect(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
