import { db } from "./db";
import { uid, days, type Gear, type Item, type Trip } from "./model";
export async function purchase(id: string, gear: Gear, existingId?: string) {
  return db.transaction(
    "rw",
    [db.wishes, db.gear, db.items, db.trips],
    async () => {
      const wish = await db.wishes.get(id);
      if (!wish) throw Error("待购条目不存在");
      if (wish.status === "已购买") return wish.gearId;
      let gearId = gear.id;
      if (existingId) {
        const existing = await db.gear.get(existingId);
        if (!existing || existing.archived) throw Error("所选装备不可用");
        gearId = existingId;
        await db.gear.update(gearId, {
          quantity: existing.quantity + gear.quantity,
        });
      } else await db.gear.add(gear);
      const previousItem = wish.tripItemId
        ? await db.items.get(wish.tripItemId)
        : undefined;
      if (previousItem) {
        const trip = await db.trips.get(previousItem.tripId);
        if (trip?.status !== "已完成")
          await db.items.update(previousItem.id, {
            gearId,
            name: gear.name,
            weight: gear.weight,
            price: gear.price,
          });
      }
      await db.wishes.update(id, {
        status: "已购买",
        gearId,
        purchaseQty: gear.quantity,
        merged: !!existingId,
        previousItem,
      });
      return gearId;
    },
  );
}
export async function undoPurchase(id: string) {
  await db.transaction(
    "rw",
    [db.wishes, db.gear, db.items, db.trips, db.templates, db.expenses],
    async () => {
      const w = await db.wishes.get(id);
      if (!w || w.status !== "已购买" || !w.gearId) return;
      const refs = await db.items.where("gearId").equals(w.gearId).toArray();
      const other = refs.filter((i) => i.id !== w.previousItem?.id);
      if (
        other.length ||
        (await db.wishes
          .filter(
            (otherWish) =>
              otherWish.id !== w.id && otherWish.gearId === w.gearId,
          )
          .count()) ||
        (await db.templates
          .filter((t) => t.items.some((i) => i.gearId === w.gearId))
          .count()) ||
        (await db.expenses.filter((e) => e.gearId === w.gearId).count())
      )
        throw Error(
          "该装备已被其他行程、模板、费用或购买记录引用，请先解除关联；不会删除装备。",
        );
      if (w.previousItem) {
        const t = await db.trips.get(w.previousItem.tripId);
        if (t?.status === "已完成")
          throw Error("关联行程已完成，不能撤销购买。");
        await db.items.put(w.previousItem);
      }
      const g = await db.gear.get(w.gearId);
      if (g) {
        if (
          (!w.merged && g.quantity !== w.purchaseQty) ||
          (w.merged && g.quantity < (w.purchaseQty || 0))
        )
          throw Error(
            "装备数量在购买后已经调整，请先核实数量，撤销不会静默删除变更。",
          );
        if (w.merged)
          await db.gear.update(g.id, {
            quantity: Math.max(0, g.quantity - (w.purchaseQty || 0)),
          });
        else await db.gear.delete(g.id);
      }
      await db.wishes.update(id, {
        status: "待购买",
        gearId: undefined,
        purchaseQty: undefined,
        previousItem: undefined,
      });
    },
  );
}
export async function removeGear(id: string) {
  if (
    (await db.expenses.filter((e) => e.gearId === id).count()) ||
    (await db.templates
      .filter((t) => t.items.some((i) => i.gearId === id))
      .count()) ||
    (await db.items.where("gearId").equals(id).count()) ||
    (await db.wishes.filter((w) => w.gearId === id).count())
  )
    await db.gear.update(id, { archived: true });
  else await db.gear.delete(id);
}
export function snapshot(g: Gear, tripId: string): Item {
  return {
    id: uid(),
    tripId,
    gearId: g.id,
    name: g.name,
    category: g.category,
    categoryId: g.categoryId,
    quantity: 1,
    weight: g.weight,
    price: g.price,
    required: true,
    carry: "背包内",
    kind: "非消耗品",
    state: "待准备",
    notes: "",
  };
}
export async function copyTrip(id: string) {
  return db.transaction("rw", db.tables, async () => {
    const t = await db.trips.get(id);
    if (!t) throw Error("行程不存在");
    const newId = uid();
    await db.trips.add({
      ...t,
      id: newId,
      name: t.name + " · 副本",
      status: "计划中",
    });
    const supplies = await db.supplies.where("tripId").equals(id).toArray();
    const sm = new Map(supplies.map((s) => [s.id, uid()]));
    for (const s of supplies)
      await db.supplies.add({ ...s, id: sm.get(s.id)!, tripId: newId });
    for (const i of await db.items.where("tripId").equals(id).toArray())
      await db.items.add({
        ...i,
        id: uid(),
        tripId: newId,
        state: "待准备",
        used: undefined,
        rating: undefined,
        replace: false,
      });
    for (const m of await db.meals.where("tripId").equals(id).toArray())
      await db.meals.add({
        ...m,
        id: uid(),
        tripId: newId,
        supplyId: sm.get(m.supplyId) || "",
      });
    for (const d of await db.daily.where("tripId").equals(id).toArray())
      await db.daily.add({ ...d, id: uid(), tripId: newId });
    return newId;
  });
}
export async function saveTrip(t: Trip) {
  await db.transaction(
    "rw",
    [db.trips, db.daily, db.meals, db.supplies],
    async () => {
      const n = days(t);
      const old = await db.trips.get(t.id);
      if (old && n < days(old)) {
        const outside =
          (await db.meals
            .where("tripId")
            .equals(t.id)
            .filter((m) => m.day > n)
            .count()) +
          (await db.daily
            .where("tripId")
            .equals(t.id)
            .filter((d) => d.day > n)
            .count()) +
          (await db.supplies
            .where("tripId")
            .equals(t.id)
            .filter((s) => s.day > n)
            .count());
        if (outside)
          throw Error(
            "缩短日期会超出已有每日计划、餐食或补给点。请先移除超出的安排。",
          );
      }
      await db.trips.put(t);
    },
  );
}
export async function deleteTrip(id: string) {
  await db.transaction("rw", db.tables, async () => {
    const its = await db.items.where("tripId").equals(id).primaryKeys();
    await db.wishes
      .filter((w) => !!w.tripItemId && its.includes(w.tripItemId))
      .modify({ tripItemId: undefined, previousItem: undefined });
    for (const name of [
      "items",
      "meals",
      "supplies",
      "daily",
      "procurement",
      "expenses",
      "reviews",
    ])
      await db.table(name).where("tripId").equals(id).delete();
    await db.trips.delete(id);
  });
}
