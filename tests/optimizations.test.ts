import { beforeEach, describe, it, expect, vi } from "vitest";
import Dexie from "dexie";
import { db, HikingDB } from "../src/db";
import { uid, type Gear, type Trip, type Template } from "../src/model";
import { migrateData, categoryKey } from "../src/migration";
import {
  business,
  defaultMeta,
  setBackupThreshold,
  snoozeBackup,
} from "../src/changes";
import {
  applyTemplate,
  addGearBatch,
  saveTemplate,
  templatePreview,
  gearDifferences,
  syncGear,
  packItems,
  undoPack,
  cycleItem,
  templateFromTrip,
} from "../src/packingService";
import { snapshot } from "../src/services";
import {
  saveCategory,
  deleteCategory,
  moveCategory,
} from "../src/categoryService";
import { exportAndRecord, exportBackup, restoreBackup } from "../src/backup";
const gear = (overrides: Partial<Gear> = {}): Gear => ({
  id: uid(),
  name: "同名背包",
  category: "背负",
  categoryId: categoryKey("gear", "背负"),
  brand: "",
  model: "",
  weight: 1000,
  quantity: 1,
  price: 10000,
  date: "2026-09-01",
  status: "正常",
  location: "",
  notes: "",
  tags: "",
  maintenance: "",
  ...overrides,
});
const trip = (status = "计划中"): Trip => ({
  id: uid(),
  name: "新行程",
  location: "",
  start: "2026-10-01",
  end: "2026-10-03",
  distance: 10,
  ascent: 100,
  weather: "",
  route: "",
  emergency: "",
  budget: null,
  target: 2000,
  status,
});
beforeEach(async () => {
  await db.transaction("rw", db.tables, async (tx) => {
    for (const t of db.tables) await t.clear();
    await migrateData(tx);
  });
});
async function fixture() {
  const t = trip(),
    g1 = gear(),
    g2 = gear();
  await db.trips.add(t);
  await db.gear.bulkAdd([g1, g2]);
  const a = snapshot(g1, t.id);
  await db.items.add({ ...a, quantity: 3, notes: "保留备注", state: "已准备" });
  const { id, tripId, ...temp } = snapshot(g2, t.id);
  const tpl: Template = {
    id: uid(),
    name: "露营",
    notes: "",
    items: [
      { ...temp, gearId: g1.id, sourceId: "source:1" },
      { ...temp, sourceId: "source:2" },
      { ...temp, gearId: undefined, sourceId: "stable:temporary" },
    ],
  };
  await db.templates.add(tpl);
  return { t, g1, g2, a, tpl };
}
describe("模板与批量添加", () => {
  it("临时条目转为正式装备后，同模板临时来源依然去重", async () => {
    const { t, tpl, g2 } = await fixture();
    await applyTemplate(t.id, tpl.id);
    const temp = await db.items
      .filter((i) => i.sourceId === "stable:temporary")
      .first();
    await db.items.update(temp!.id, { gearId: g2.id });
    expect(await applyTemplate(t.id, tpl.id)).toBe(0);
  });
  it("按库 ID 区分同名装备，重复套用与并发不改变数量备注状态，临时来源稳定", async () => {
    const { t, a, tpl } = await fixture();
    expect(templatePreview(tpl, await db.items.toArray())).toMatchObject({
      total: 3,
      existing: 1,
    });
    expect(await applyTemplate(t.id, tpl.id)).toBe(2);
    expect(await applyTemplate(t.id, tpl.id)).toBe(0);
    await Promise.all([
      applyTemplate(t.id, tpl.id),
      applyTemplate(t.id, tpl.id),
    ]);
    expect(await db.items.count()).toBe(3);
    expect(await db.items.get(a.id)).toMatchObject({
      quantity: 3,
      notes: "保留备注",
      state: "已准备",
    });
    expect((await db.meta.get("data"))?.changes).toBe(1);
  });
  it("模板编辑与套用行程相互独立；来源稳定且已有条目不覆盖", async () => {
    const { t, tpl } = await fixture();
    await applyTemplate(t.id, tpl.id);
    const previous = await db.items.toArray();
    await saveTemplate({
      ...tpl,
      name: "改名",
      notes: "新备注",
      items: tpl.items.map((i) => ({ ...i, weight: 9000, quantity: 9 })),
    });
    await applyTemplate(t.id, tpl.id);
    expect(await db.items.toArray()).toEqual(previous);
  });
  it("从行程保存临时物品到模板后套回不会重复", async () => {
    const { t } = await fixture();
    const i = { ...snapshot(gear(), t.id), gearId: undefined };
    await db.items.add(i);
    await templateFromTrip(t.id, "自己的模板");
    const saved = (await db.templates.toArray()).find(
      (x) => x.name === "自己的模板",
    )!;
    expect(await applyTemplate(t.id, saved.id)).toBe(0);
  });
  it("批量添加提交时重查，双击只加入一次，非法装备导致整个批次回滚", async () => {
    const { t, g1, g2 } = await fixture();
    await Promise.all([
      addGearBatch(t.id, [g1.id, g2.id]),
      addGearBatch(t.id, [g2.id]),
    ]);
    expect(await db.items.count()).toBe(2);
    const g3 = gear();
    await db.gear.add(g3);
    await expect(addGearBatch(t.id, [g3.id, "missing"])).rejects.toThrow(
      "不可用",
    );
    expect(await db.items.count()).toBe(2);
    expect((await db.meta.get("data"))?.changes).toBe(1);
  });
});
describe("可控快照同步", () => {
  it("确认前不改；仅同步选中字段，价格与个人状态保留", async () => {
    const { t, g1, a } = await fixture();
    await db.gear.update(g1.id, {
      name: "新版背包",
      category: "服装",
      categoryId: categoryKey("gear", "服装"),
      weight: 650,
      price: 99999,
    });
    const diffs = gearDifferences(
      await db.items.toArray(),
      await db.gear.toArray(),
    );
    expect(diffs.diffs).toHaveLength(3);
    expect((await db.items.get(a.id))?.weight).toBe(1000);
    await syncGear(
      t.id,
      diffs.diffs.filter((d) => d.field === "weight"),
    );
    expect(await db.items.get(a.id)).toMatchObject({
      name: "同名背包",
      weight: 650,
      price: 10000,
      quantity: 3,
      notes: "保留备注",
      state: "已准备",
      carry: "背包内",
      required: true,
    });
  });
  it("进行中/完成禁止同步；预览过期或装备归档时不覆盖", async () => {
    const { t, g1, a } = await fixture();
    await db.gear.update(g1.id, { weight: 650 });
    const diffs = gearDifferences(
      await db.items.toArray(),
      await db.gear.toArray(),
    ).diffs;
    for (const status of ["进行中", "已完成"]) {
      await db.trips.update(t.id, { status });
      await expect(syncGear(t.id, diffs)).rejects.toThrow();
    }
    await db.trips.update(t.id, { status: "计划中" });
    await db.gear.update(g1.id, { weight: 500 });
    await expect(syncGear(t.id, diffs)).rejects.toThrow("预览后");
    await db.gear.update(g1.id, { archived: true });
    expect(
      gearDifferences(await db.items.toArray(), await db.gear.toArray())
        .unavailable,
    ).toHaveLength(1);
    expect((await db.items.get(a.id))?.weight).toBe(1000);
  });
});
describe("装包与撤销", () => {
  it("不同初态直接装包与逐项撤销准确，并发操作互不串项", async () => {
    const { t, a, g2 } = await fixture();
    await addGearBatch(t.id, [g2.id]);
    const b = (await db.items.where("gearId").equals(g2.id).first())!;
    const [oa, ob] = await Promise.all([
      packItems(t.id, [a.id]),
      packItems(t.id, [b.id]),
    ]);
    await undoPack(oa);
    expect((await db.items.get(a.id))?.state).toBe("已准备");
    expect((await db.items.get(b.id))?.state).toBe("已装包");
    await undoPack(ob);
    expect((await db.items.get(b.id))?.state).toBe("待准备");
  });
  it("批量仅影响指定范围并恢复各自状态，重复撤销与过期操作阻止", async () => {
    const { t, a, g2 } = await fixture();
    await addGearBatch(t.id, [g2.id]);
    const ids = (await db.items.toArray()).map((i) => i.id);
    const op = await packItems(t.id, ids);
    await undoPack(op);
    expect((await db.items.get(a.id))?.state).toBe("已准备");
    expect((await db.items.where("gearId").equals(g2.id).first())?.state).toBe(
      "待准备",
    );
    await expect(undoPack(op)).rejects.toThrow("其他操作");
    const op2 = await packItems(t.id, [a.id]);
    await cycleItem(t.id, a.id);
    await expect(undoPack(op2)).rejects.toThrow();
    expect((await db.items.get(a.id))?.state).toBe("待准备");
  });
});
describe("分类管理与迁移", () => {
  it("重命名用稳定 ID；历史与待确认快照不变，停用仍保留引用", async () => {
    const { t, g1, a } = await fixture();
    await db.trips.update(t.id, { status: "已完成" });
    const c = (await db.categories.get(g1.categoryId!))!;
    await saveCategory({ ...c, name: " 徒步背包 " });
    expect((await db.gear.get(g1.id))?.category).toBe("徒步背包");
    expect((await db.items.get(a.id))?.category).toBe("背负");
    await saveCategory({ ...c, name: "徒步背包", disabled: true });
    expect((await db.categories.get(c.id))?.disabled).toBe(true);
    await expect(deleteCategory(c.id)).rejects.toThrow("已被引用");
    await deleteCategory(c.id, categoryKey("gear", "其他"));
    expect((await db.items.get(a.id))?.category).toBe("背负");
    expect((await db.items.get(a.id))?.categoryId).toBe(
      categoryKey("gear", "其他"),
    );
  });
  it("空名、重复名、跨体系迁移拒绝；排序保留 ID，删除后备份恢复不复活", async () => {
    const c = (await db.categories.get(categoryKey("gear", "住宿")))!;
    await expect(saveCategory({ ...c, name: "  " })).rejects.toThrow(
      "不能为空",
    );
    await expect(saveCategory({ ...c, name: "背负" })).rejects.toThrow("同名");
    await saveCategory({ ...c, name: "交通" });
    expect(await db.categories.where("name").equals("交通").count()).toBe(2);
    await moveCategory(c.id, 1);
    expect((await db.categories.get(c.id))?.order).toBe(2);
    await deleteCategory(c.id);
    const b = await exportBackup();
    await restoreBackup(b);
    expect(await db.categories.get(c.id)).toBeUndefined();
  });
  it("真实 v2 表升级保留所有快照、去除分类名首尾空格去重、赋予临时来源", async () => {
    const name = `v2-${uid()}`,
      legacy = new Dexie(name);
    const stores = {
      gear: "id,category,status,maintenance",
      trips: "id,start",
      items: "id,tripId,gearId",
      templates: "id",
      foods: "id",
      meals: "id,tripId,foodId",
      supplies: "id,tripId",
      daily: "id,tripId",
      procurement: "id,tripId",
      expenses: "id,tripId",
      wishes: "id,status",
      reviews: "id,tripId",
      attachments: "id",
    };
    legacy.version(2).stores(stores);
    const g = gear({ category: " 自定义 ", categoryId: undefined }),
      g2 = gear({ category: "自定义", categoryId: undefined }),
      t = trip("已完成");
    await legacy.table("gear").bulkAdd([g, g2]);
    await legacy.table("trips").add(t);
    const i = { ...snapshot(g, t.id), gearId: undefined };
    await legacy.table("items").add(i);
    await legacy
      .table("templates")
      .add({
        id: "old",
        name: "旧模板",
        items: [{ ...i, id: undefined, tripId: undefined }],
      });
    legacy.close();
    const fresh = new HikingDB(name);
    try {
      await fresh.open();
      expect(await fresh.gear.count()).toBe(2);
      expect(
        await fresh.categories.where("name").equals("自定义").count(),
      ).toBe(1);
      expect(await fresh.items.get(i.id)).toMatchObject({
        name: i.name,
        weight: i.weight,
        category: " 自定义 ",
      });
      expect((await fresh.templates.get("old"))?.items[0].sourceId).toBe(
        "template:old:0",
      );
    } finally {
      await fresh.delete();
    }
  });
});
describe("业务修改与导出计数", () => {
  it("导出期间其他操作的修改被保留，计数及时间重开数据库仍存在", async () => {
    const { a } = await fixture();
    await db.meta.put({ ...defaultMeta, changes: 30 });
    let pending: Promise<unknown> | undefined;
    await exportAndRecord(() => {
      pending = business(() =>
        db.items.update(a.id, { notes: "导出期间新增修改" }),
      );
    });
    await pending;
    expect((await db.meta.get("data"))?.changes).toBe(1);
    const meta = await db.meta.get("data");
    db.close();
    await db.open();
    expect(await db.meta.get("data")).toEqual(meta);
  });
  it("批量只计一次、嵌套不双计、无效修改与读取不计，失败回滚", async () => {
    const { t, a } = await fixture();
    await business(async () => {
      await db.items.update(a.id, { notes: "一次" });
      await business(() => db.trips.update(t.id, { name: "一起改" }));
    });
    expect((await db.meta.get("data"))?.changes).toBe(1);
    await business(() => db.items.update(a.id, { notes: "一次" }));
    await business(() => db.items.toArray());
    expect((await db.meta.get("data"))?.changes).toBe(1);
    await expect(
      business(async () => {
        await db.items.update(a.id, { notes: "回滚" });
        throw Error("失败");
      }),
    ).rejects.toThrow();
    expect((await db.items.get(a.id))?.notes).toBe("一次");
    expect((await db.meta.get("data"))?.changes).toBe(1);
  });
  it("仅发起成功导出才重置；失败保留；导出后新修改不丢计数", async () => {
    await db.meta.put({ ...defaultMeta, changes: 30 });
    await expect(
      exportAndRecord(() => {
        throw Error("下载失败");
      }),
    ).rejects.toThrow();
    expect((await db.meta.get("data"))?.changes).toBe(30);
    expect((await db.meta.get("data"))?.lastExport).toBeNull();
    let captured = "";
    await exportAndRecord((_name, text) => {
      captured = text;
    });
    expect(JSON.parse(captured).version).toBe(2);
    expect((await db.meta.get("data"))?.changes).toBe(0);
    expect((await db.meta.get("data"))?.lastExport).toBeTruthy();
    await setBackupThreshold(7);
    await snoozeBackup();
    expect((await db.meta.get("data"))?.threshold).toBe(7);
    expect((await db.meta.get("data"))!.snoozeUntil).toBeGreaterThan(
      Date.now(),
    );
    expect((await db.meta.get("data"))?.changes).toBe(0);
  });
  it("v1 备份兼容升级不丢数据，本机导出时间不被旧备份覆盖", async () => {
    const { t } = await fixture();
    const backup = await exportBackup();
    backup.version = 1;
    delete backup.data.categories;
    for (const table of ["gear", "items", "templates"])
      for (const row of backup.data[table] as any[]) {
        delete row.categoryId;
        delete row.sourceId;
        if (row.items)
          for (const i of row.items) {
            delete i.categoryId;
            delete i.sourceId;
          }
      }
    await db.meta.put({
      ...defaultMeta,
      lastExport: "2026-09-10T00:00:00.000Z",
    });
    await restoreBackup(backup);
    expect(await db.trips.get(t.id)).toEqual(t);
    expect(await db.categories.count()).toBeGreaterThan(0);
    expect((await db.meta.get("data"))?.lastExport).toBe(
      "2026-09-10T00:00:00.000Z",
    );
    expect((await db.meta.get("data"))?.changes).toBe(1);
  });
});
