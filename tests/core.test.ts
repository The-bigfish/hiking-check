import { beforeEach, describe, it, expect, vi } from "vitest";
import { db } from "../src/db";
import { HikingDB } from "../src/db";
import Dexie from "dexie";
import { categoryKey, migrateData } from "../src/migration";
import { seedDemo } from "../src/demo";
import {
  weights,
  shopping,
  supplyLoads,
  mealTotal,
  uid,
  today,
  type Gear,
  type Trip,
  type Meal,
  type Wish,
} from "../src/model";
import {
  purchase,
  undoPurchase,
  copyTrip,
  snapshot,
  saveTrip,
  removeGear,
} from "../src/services";
import { exportBackup, restoreBackup, validateBackup } from "../src/backup";
const gear = (): Gear => ({
  id: uid(),
  name: "背包",
  category: "背负",
  categoryId: categoryKey("gear", "背负"),
  brand: "",
  model: "",
  weight: 1000,
  quantity: 1,
  price: 89900,
  date: today(),
  status: "正常",
  location: "",
  notes: "",
  tags: "",
  maintenance: "",
});
const trip = (): Trip => ({
  id: uid(),
  name: "测试行程",
  location: "武功山",
  start: "2026-10-01",
  end: "2026-10-03",
  distance: 20,
  ascent: 1000,
  weather: "",
  route: "",
  emergency: "",
  budget: null,
  target: 2500,
  status: "计划中",
});
const wish = (): Wish => ({
  id: uid(),
  name: "背包",
  category: "背负",
  brand: "",
  model: "",
  price: 90000,
  weight: 1000,
  url: "",
  priority: "普通",
  reason: "",
  status: "待购买",
});
beforeEach(async () => {
  await db.transaction("rw", db.tables, async () => {
    for (const t of db.tables) await t.clear();
    await migrateData(Dexie.currentTransaction!);
  });
});
describe("负重与餐食同源计算", () => {
  it("补给区间起始负重包含之前领取但未来才食用的食物", () => {
    const meals = [
      { day: 1, weight: 100, servings: 1, supplyId: "" },
      { day: 3, weight: 200, servings: 1, supplyId: "" },
      { day: 3, weight: 300, servings: 1, supplyId: "s" },
    ] as Meal[];
    const intervals = supplyLoads(
      meals,
      [{ id: "s", tripId: "t", day: 3, name: "补给" }],
      4,
    );
    expect(intervals[0]).toMatchObject({
      carryWeight: 300,
      receiveWeight: 300,
      endDay: 2,
    });
    expect(intervals[1]).toMatchObject({
      carryWeight: 500,
      receiveWeight: 300,
      endDay: 4,
    });
  });
  it("数量、本人公共份额、饮水、穿戴和食物不重复", () => {
    const g = gear(),
      t = trip();
    const base = snapshot(g, t.id);
    const items = [
      { ...base, quantity: 2 },
      { ...base, carry: "公共装备", weight: 800, quantity: 0.5 },
      { ...base, carry: "穿戴", weight: 300, quantity: 2 },
      { ...base, kind: "饮水", weight: 1000, quantity: 2 },
      { ...base, kind: "消耗品", weight: 230, quantity: 1 },
    ];
    const meals = [
      { weight: 100, kcal: 400, price: 500, servings: 2, supplyId: "" },
      { weight: 300, kcal: 500, price: 200, servings: 1, supplyId: "supply" },
    ] as Meal[];
    expect(weights(items, meals)).toEqual({
      base: 2400,
      worn: 600,
      water: 2000,
      consumable: 230,
      food: 200,
      total: 4830,
    });
    expect(mealTotal(meals)).toEqual({ weight: 500, kcal: 1300, price: 1200 });
  });
  it("采购按食物合并份数，超额备齐不产生负数", () => {
    const meals = [
      { foodId: "a", name: "米饭", weight: 100, price: 500, servings: 1 },
      { foodId: "a", name: "米饭", weight: 100, price: 500, servings: 2 },
    ] as Meal[];
    expect(
      shopping(meals, [{ id: "a", foodId: "a", tripId: "t", ready: 2 }])[0],
    ).toMatchObject({
      servings: 3,
      ready: 2,
      needed: 1,
      weight: 300,
      price: 1500,
    });
    expect(
      shopping(meals, [{ id: "a", foodId: "a", tripId: "t", ready: 9 }])[0]
        .needed,
    ).toBe(0);
  });
});
describe("事务与历史", () => {
  it("v1 数据库升级到 v2 补齐保养字段且保留原有装备", async () => {
    const name = `migration-${uid()}`;
    const legacy = new Dexie(name);
    legacy.version(1).stores({ gear: "id,category,status" });
    const old = gear();
    const { maintenance, ...withoutMaintenance } = old;
    await legacy.table("gear").add(withoutMaintenance);
    legacy.close();
    const upgraded = new HikingDB(name);
    await upgraded.open();
    expect(await upgraded.gear.get(old.id)).toEqual({
      ...old,
      maintenance: "",
    });
    expect(upgraded.verno).toBe(3);
    await upgraded.delete();
  });
  it("连续购买及重试只生成一件装备", async () => {
    const w = wish();
    await db.wishes.add(w);
    const g = gear();
    await Promise.all([purchase(w.id, g), purchase(w.id, { ...g, id: uid() })]);
    await purchase(w.id, { ...g, id: uid() });
    expect(await db.gear.count()).toBe(1);
    expect((await db.wishes.get(w.id))?.gearId).toBe(g.id);
  });
  it("增购只增加一次数量，撤销还原数量", async () => {
    const g = gear(),
      w = wish();
    await db.gear.add(g);
    await db.wishes.add(w);
    await purchase(w.id, { ...g, quantity: 2 }, g.id);
    await purchase(w.id, { ...g, quantity: 2 }, g.id);
    expect((await db.gear.get(g.id))?.quantity).toBe(3);
    await undoPurchase(w.id);
    expect((await db.gear.get(g.id))?.quantity).toBe(1);
  });
  it("购买替换临时装备保留打包状态，撤销还原", async () => {
    const g = gear(),
      t = trip(),
      w = wish();
    const i = { ...snapshot(g, t.id), gearId: undefined, state: "已装包" };
    w.tripItemId = i.id;
    await db.trips.add(t);
    await db.items.add(i);
    await db.wishes.add(w);
    await purchase(w.id, g);
    expect(await db.items.get(i.id)).toMatchObject({
      state: "已装包",
      gearId: g.id,
    });
    await undoPurchase(w.id);
    expect(await db.items.get(i.id)).toMatchObject({
      state: "已装包",
      gearId: undefined,
    });
    expect(await db.gear.count()).toBe(0);
  });
  it("装备被其他行程引用时阻止撤销且保留数据", async () => {
    const g = gear(),
      w = wish(),
      t = trip();
    await db.trips.add(t);
    await db.wishes.add(w);
    await purchase(w.id, g);
    await db.items.add(snapshot(g, t.id));
    await expect(undoPurchase(w.id)).rejects.toThrow("其他行程");
    expect((await db.wishes.get(w.id))?.status).toBe("已购买");
    expect(await db.gear.count()).toBe(1);
  });
  it("复制重置状态且不复制实际支付；完成行程保留重量快照", async () => {
    const g = gear(),
      t = { ...trip(), status: "已完成" };
    await db.gear.add(g);
    await db.trips.add(t);
    const i = { ...snapshot(g, t.id), state: "已装包" };
    await db.items.add(i);
    await db.expenses.add({
      id: uid(),
      tripId: t.id,
      amount: 100,
      category: "交通",
      date: today(),
      notes: "",
    });
    const copied = await copyTrip(t.id);
    expect((await db.items.where("tripId").equals(copied).first())?.state).toBe(
      "待准备",
    );
    expect((await db.items.get(i.id))?.state).toBe("已装包");
    expect(await db.expenses.where("tripId").equals(copied).count()).toBe(0);
    await db.gear.update(g.id, { weight: 9999 });
    expect((await db.items.get(i.id))?.weight).toBe(1000);
    await removeGear(g.id);
    expect((await db.gear.get(g.id))?.archived).toBe(true);
  });
  it("缩短日期不会静默丢弃计划", async () => {
    const t = trip();
    await db.trips.add(t);
    await db.daily.add({
      id: uid(),
      tripId: t.id,
      day: 3,
      start: "a",
      end: "b",
      camp: "",
      water: "",
      resupply: "",
      notes: "",
    });
    await expect(saveTrip({ ...t, end: t.start })).rejects.toThrow("缩短日期");
    expect((await db.trips.get(t.id))?.end).toBe(t.end);
  });
});
describe("完整备份", () => {
  it("完整演示数据恢复保留模板、补给、餐食、采购与费用关联", async () => {
    await seedDemo();
    const full = await exportBackup();
    await restoreBackup(JSON.parse(JSON.stringify(full)));
    expect((await exportBackup()).data).toEqual(full.data);
    expect(await db.meals.count()).toBe(12);
    expect(await db.expenses.count()).toBe(1);
  });
  it("恢复写入中途失败，整个覆盖事务回滚", async () => {
    const g = gear();
    await db.gear.add(g);
    const backup = await exportBackup();
    (backup.data.gear[0] as Gear).name = "恢复版本";
    const spy = vi
      .spyOn(db.table("foods"), "bulkAdd")
      .mockRejectedValueOnce(new Error("模拟存储配额不足"));
    await expect(restoreBackup(backup)).rejects.toThrow("模拟存储配额不足");
    spy.mockRestore();
    expect((await db.gear.get(g.id))?.name).toBe(g.name);
  });
  it("照片、关联、整数金额往返保持完整", async () => {
    const g = { ...gear(), attachmentId: uid() },
      t = trip();
    await db.attachments.add({
      id: g.attachmentId,
      data: "data:image/png;base64,aGVsbG8=",
      name: "照片",
    });
    await db.gear.add(g);
    await db.trips.add(t);
    await db.items.add(snapshot(g, t.id));
    const backup = await exportBackup();
    await db.gear.update(g.id, { name: "修改后" });
    await restoreBackup(JSON.parse(JSON.stringify(backup)));
    expect(await db.gear.get(g.id)).toEqual(g);
    expect((await db.attachments.get(g.attachmentId))?.data).toBe(
      "data:image/png;base64,aGVsbG8=",
    );
    expect(await db.items.count()).toBe(1);
  });
  it("非法版本、负值和断裂关联拒绝，原始数据不变", async () => {
    const g = gear();
    await db.gear.add(g);
    const b = await exportBackup();
    expect(() => validateBackup({ ...b, version: 99 })).toThrow();
    (b.data.gear[0] as Gear).weight = -1;
    await expect(restoreBackup(b)).rejects.toThrow();
    expect((await db.gear.get(g.id))?.weight).toBe(1000);
    const b2 = await exportBackup();
    (b2.data.gear[0] as Gear).attachmentId = "missing";
    await expect(restoreBackup(b2)).rejects.toThrow("照片附件缺失");
    expect(await db.gear.count()).toBe(1);
  });
  it("空库可以备份恢复，食物计划不会产生实际支出", async () => {
    const b = await exportBackup();
    await restoreBackup(b);
    expect(await db.expenses.count()).toBe(0);
    expect(await db.gear.count()).toBe(0);
  });
});
