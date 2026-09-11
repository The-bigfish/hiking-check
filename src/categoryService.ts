import { db } from "./db";
import { business } from "./changes";
import { uid, type Category, type CategorySystem } from "./model";
import { iconNames } from "./migration";
export async function saveCategory(input: Category) {
  return business(async () => {
    const name = input.name.trim();
    if (!name) throw Error("分类名称不能为空");
    if (!iconNames.includes(input.icon)) throw Error("请选择内置图标");
    if (
      await db.categories
        .filter(
          (c) =>
            c.id !== input.id && c.system === input.system && c.name === name,
        )
        .count()
    )
      throw Error("该体系已存在同名分类");
    const old = await db.categories.get(input.id);
    if (old && old.system !== input.system) throw Error("不能更换分类体系");
    await db.categories.put({ ...input, name });
    if (old && old.name !== name)
      await relabel(input.id, input.id, name, input.system, false);
  });
}
async function relabel(
  from: string,
  to: string,
  name: string,
  system: CategorySystem,
  move: boolean,
) {
  const completed = new Set(
    (await db.trips.filter((t) => t.status === "已完成").toArray()).map(
      (t) => t.id,
    ),
  );
  const update = (r: any) => {
    r.categoryId = to;
    if (!completed.has(r.tripId)) r.category = name;
  };
  for (const table of system === "gear"
    ? ["gear", "wishes", "items"]
    : ["expenses"]) {
    await db
      .table(table)
      .filter((r: any) => r.categoryId === from)
      .modify((r: any) => {
        if (table === "items") {
          r.categoryId = to;
        } else update(r);
      });
  }
  if (system === "gear") {
    await db.templates
      .filter((t) => t.items.some((i) => i.categoryId === from))
      .modify((t) => {
        for (const i of t.items)
          if (i.categoryId === from) {
            i.categoryId = to;
            i.category = name;
          }
      });
    await db.wishes
      .filter((w) => w.previousItem?.categoryId === from)
      .modify((w) => {
        if (w.previousItem) update(w.previousItem);
      });
  }
}
export async function categoryReferences(id: string) {
  let n = 0;
  for (const table of [db.gear, db.items, db.wishes, db.expenses])
    n += await table.filter((r: any) => r.categoryId === id).count();
  for (const t of await db.templates.toArray())
    n += t.items.filter((i) => i.categoryId === id).length;
  n += await db.wishes.filter((w) => w.previousItem?.categoryId === id).count();
  return n;
}
export async function deleteCategory(id: string, targetId?: string) {
  return business(async () => {
    const c = await db.categories.get(id);
    if (!c) return;
    if (await categoryReferences(id)) {
      const target = targetId ? await db.categories.get(targetId) : undefined;
      if (
        !target ||
        target.id === id ||
        target.disabled ||
        target.system !== c.system
      )
        throw Error("分类已被引用，请选择迁移到其他启用分类，或停用此分类");
      await relabel(id, target.id, target.name, c.system, true);
    }
    await db.categories.delete(id);
  });
}
export async function moveCategory(id: string, direction: number) {
  return business(async () => {
    const c = await db.categories.get(id);
    if (!c) return;
    const all = await db.categories
      .where("system")
      .equals(c.system)
      .sortBy("order");
    const pos = all.findIndex((x) => x.id === id),
      next = pos + direction;
    if (next < 0 || next >= all.length) return;
    [all[pos], all[next]] = [all[next], all[pos]];
    await db.categories.bulkPut(all.map((c, order) => ({ ...c, order })));
  });
}
