import { db } from "./db";
import { business } from "./changes";
import { snapshot } from "./services";
import { uid, type Item, type Template, type Gear, type Trip } from "./model";
type Entry = Template["items"][number];
export const entryKey = (i: Pick<Item, "gearId" | "sourceId">) =>
  i.gearId ? `gear:${i.gearId}` : i.sourceId ? `source:${i.sourceId}` : "";
export function templatePreview(template: Template, items: Item[]) {
  const keys = new Set(
    items
      .flatMap((i) => [
        entryKey(i),
        ...(i.sourceId ? [`source:${i.sourceId}`] : []),
      ])
      .filter(Boolean),
  );
  let existing = 0;
  const missing: Entry[] = [];
  for (const i of template.items) {
    const key = entryKey(i);
    if (!key) throw Error("模板临时物品缺少来源标识，请重新保存模板");
    if (keys.has(key)) existing++;
    else {
      keys.add(key);
      missing.push(i);
    }
  }
  return { total: template.items.length, existing, missing };
}
async function editable(tripId: string) {
  const t = await db.trips.get(tripId);
  if (!t) throw Error("行程不存在");
  if (t.status === "已完成") throw Error("已完成行程不能修改打包快照");
  return t;
}
export async function applyTemplate(tripId: string, templateId: string) {
  return business(async () => {
    await editable(tripId);
    const t = await db.templates.get(templateId);
    if (!t) throw Error("模板不存在");
    const p = templatePreview(
      t,
      await db.items.where("tripId").equals(tripId).toArray(),
    );
    await db.items.bulkAdd(
      p.missing.map((i) => ({
        ...i,
        id: uid(),
        tripId,
        state: "待准备",
        stateToken: undefined,
        used: undefined,
        rating: undefined,
        replace: false,
      })),
    );
    return p.missing.length;
  });
}
export async function addGearBatch(tripId: string, ids: string[]) {
  return business(async () => {
    await editable(tripId);
    const keys = new Set(
      (await db.items.where("tripId").equals(tripId).toArray()).map(entryKey),
    );
    const add: Item[] = [];
    for (const id of new Set(ids)) {
      if (keys.has(`gear:${id}`)) continue;
      const g = await db.gear.get(id);
      if (!g || g.archived || g.status !== "正常")
        throw Error("选中装备已被移除、归档或不可用，请重新检查");
      add.push(snapshot(g, tripId));
    }
    await db.items.bulkAdd(add);
    return add.length;
  });
}
export async function saveTemplate(t: Template) {
  return business(async () => {
    if (!t.name.trim()) throw Error("请输入模板名称");
    const items = t.items.map((i) => ({
      ...i,
      sourceId: i.sourceId || uid(),
      state: "待准备",
      stateToken: undefined,
    }));
    for (const i of items)
      if (
        !i.name.trim() ||
        !Number.isFinite(i.quantity) ||
        i.quantity <= 0 ||
        !Number.isInteger(i.weight) ||
        i.weight < 0
      )
        throw Error("模板名称、数量或重量不合法");
    await db.templates.put({
      ...t,
      name: t.name.trim(),
      notes: t.notes || "",
      items,
    });
  });
}
export async function templateFromTrip(tripId: string, name: string) {
  return business(async () => {
    const items = await db.items.where("tripId").equals(tripId).toArray();
    for (const i of items)
      if (!i.sourceId) {
        i.sourceId = `item:${i.id}`;
        await db.items.update(i.id, { sourceId: i.sourceId });
      }
    await saveTemplate({
      id: uid(),
      name,
      notes: "",
      items: items.map(({ id, tripId, ...i }) => ({
        ...i,
        used: undefined,
        rating: undefined,
        replace: false,
      })),
    });
  });
}
export type SyncField = "name" | "category" | "weight";
export interface Difference {
  itemId: string;
  field: SyncField;
  before: string | number;
  after: string | number;
  categoryId?: string;
}
export function gearDifferences(items: Item[], gear: Gear[]) {
  const diffs: Difference[] = [];
  const unavailable: Item[] = [];
  for (const i of items) {
    if (!i.gearId) continue;
    const g = gear.find((g) => g.id === i.gearId);
    if (!g || g.archived) {
      unavailable.push(i);
      continue;
    }
    for (const field of ["name", "category", "weight"] as const)
      if (
        i[field] !== g[field] ||
        (field === "category" && i.categoryId !== g.categoryId)
      )
        diffs.push({
          itemId: i.id,
          field,
          before: i[field],
          after: g[field],
          categoryId: field === "category" ? g.categoryId : undefined,
        });
  }
  return { diffs, unavailable };
}
export async function syncGear(tripId: string, selected: Difference[]) {
  return business(async () => {
    const t = await editable(tripId);
    if (t.status !== "计划中") throw Error("已出发或完成的行程不能同步");
    const all = await db.items.where("tripId").equals(tripId).toArray();
    const actual = gearDifferences(all, await db.gear.toArray()).diffs;
    for (const d of selected) {
      const current = actual.find(
        (c) => c.itemId === d.itemId && c.field === d.field,
      );
      if (
        !current ||
        current.before !== d.before ||
        current.after !== d.after ||
        current.categoryId !== d.categoryId
      )
        throw Error("装备或清单在预览后发生变化，请重新查看再同步");
    }
    for (const d of selected)
      await db.items.update(d.itemId, {
        [d.field]: d.after,
        ...(d.field === "category" ? { categoryId: d.categoryId } : {}),
      });
    return selected.length;
  });
}
export interface PackOperation {
  id: string;
  tripId: string;
  entries: { id: string; before: string; token: string }[];
}
export async function packItems(
  tripId: string,
  ids: string[],
): Promise<PackOperation> {
  return business(async () => {
    await editable(tripId);
    const op: PackOperation = { id: uid(), tripId, entries: [] };
    for (const id of new Set(ids)) {
      const i = await db.items.get(id);
      if (!i || i.tripId !== tripId || i.state === "已装包") continue;
      op.entries.push({ id, before: i.state, token: op.id });
      await db.items.update(id, { state: "已装包", stateToken: op.id });
    }
    return op;
  });
}
export async function undoPack(op: PackOperation) {
  return business(async () => {
    await editable(op.tripId);
    for (const e of op.entries) {
      const i = await db.items.get(e.id);
      if (
        !i ||
        i.tripId !== op.tripId ||
        i.state !== "已装包" ||
        i.stateToken !== e.token
      )
        throw Error(
          "条目在装包后已发生其他操作，本次撤销未执行，避免覆盖新状态",
        );
    }
    for (const e of op.entries)
      await db.items.update(e.id, { state: e.before, stateToken: uid() });
  });
}
export async function cycleItem(tripId: string, id: string) {
  return business(async () => {
    await editable(tripId);
    const i = await db.items.get(id);
    if (i?.tripId === tripId)
      await db.items.update(id, {
        state:
          i.state === "待准备"
            ? "已准备"
            : i.state === "已准备"
              ? "已装包"
              : "待准备",
        stateToken: uid(),
      });
  });
}
