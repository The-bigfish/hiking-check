import { z } from "zod";
import Dexie from "dexie";
import { db } from "./db";
import { migrateData } from "./migration";
import { business, defaultMeta } from "./changes";
const s = z.string(),
  n = z.number().finite().nonnegative(),
  i = n.int(),
  id = s.min(1),
  date = s
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (v) =>
        Number.isFinite(Date.parse(v)) &&
        new Date(v).toISOString().slice(0, 10) === v,
      "日期不存在",
    ),
  photo = s.optional();
const item = z.object({
  id,
  tripId: id,
  gearId: photo,
  categoryId: photo,
  sourceId: photo,
  stateToken: photo,
  name: s,
  category: s,
  quantity: n,
  weight: i,
  price: i,
  required: z.boolean(),
  carry: z.enum(["背包内", "穿戴", "公共装备"]),
  kind: z.enum(["非消耗品", "消耗品", "饮水"]),
  state: z.enum(["待准备", "已准备", "已装包"]),
  notes: s,
  used: photo,
  rating: photo,
  replace: z.boolean().optional(),
});
const schemas = {
  gear: z.object({
    id,
    name: s,
    category: s,
    categoryId: photo,
    brand: s,
    model: s,
    weight: i,
    quantity: i,
    price: i,
    date: s,
    status: z.enum(["正常", "待维修", "已退役", "已遗失"]),
    location: s,
    notes: s,
    tags: s,
    maintenance: s,
    attachmentId: photo,
    archived: z.boolean().optional(),
  }),
  trips: z
    .object({
      id,
      name: s,
      location: s,
      start: date,
      end: date,
      distance: n,
      ascent: n,
      weather: s,
      route: s,
      emergency: s,
      budget: i.nullable(),
      target: n,
      status: z.enum(["计划中", "进行中", "已完成"]),
    })
    .refine((t) => t.end >= t.start, "行程日期不合法"),
  items: item,
  templates: z.object({
    notes: photo,
    id,
    name: s,
    items: z.array(item.omit({ id: true, tripId: true })),
  }),
  foods: z.object({
    id,
    name: s,
    spec: s,
    weight: i,
    kcal: n,
    price: i,
    cook: z.boolean(),
    water: n,
    notes: s,
  }),
  meals: z.object({
    id,
    tripId: id,
    day: i.min(1),
    slot: z.enum(["早餐", "午餐", "晚餐", "加餐"]),
    foodId: id,
    name: s,
    weight: i,
    kcal: n,
    price: i,
    servings: n.positive(),
    supplyId: s,
  }),
  supplies: z.object({ id, tripId: id, name: s, day: i.min(1) }),
  daily: z.object({
    id,
    tripId: id,
    day: i.min(1),
    start: s,
    end: s,
    camp: s,
    water: s,
    resupply: s,
    notes: s,
  }),
  procurement: z.object({ id, tripId: id, foodId: id, ready: n }),
  expenses: z.object({
    categoryId: photo,
    id,
    tripId: id,
    amount: i,
    category: s,
    date,
    notes: s,
    attachmentId: photo,
    gearId: photo,
  }),
  wishes: z.object({
    categoryId: photo,
    id,
    name: s,
    category: s,
    brand: s,
    model: s,
    price: i,
    weight: i,
    url: s,
    priority: s,
    reason: s,
    status: z.enum(["待购买", "已购买", "已放弃"]),
    tripItemId: photo,
    gearId: photo,
    purchaseQty: i.optional(),
    merged: z.boolean().optional(),
    previousItem: item.optional(),
  }),
  reviews: z.object({ id, tripId: id, notes: s, leftovers: s }),
  attachments: z.object({
    id,
    data: s.regex(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/),
    name: s,
  }),
  categories: z.object({
    id,
    system: z.enum(["gear", "expense"]),
    name: s.trim().min(1),
    icon: s,
    order: i,
    disabled: z.boolean(),
  }),
};
export async function exportBackup() {
  const data: Record<string, unknown[]> = {};
  await db.transaction("r", db.tables, async () => {
    for (const table of db.tables.filter((t) => t.name !== "meta"))
      data[table.name] = await table.toArray();
  });
  return {
    format: "shanxing-backup",
    version: 2,
    createdAt: new Date().toISOString(),
    data,
  };
}
export function validateBackup(input: unknown) {
  const root = z
    .object({
      format: z.literal("shanxing-backup"),
      version: z.union([z.literal(1), z.literal(2)]),
      createdAt: s,
      data: z.record(z.array(z.unknown())),
    })
    .parse(input);
  const parsed: Record<string, any[]> = {};
  for (const [name, schema] of Object.entries(schemas)) {
    parsed[name] = z
      .array(schema)
      .parse(
        root.data[name] ??
          (name === "categories" && root.version === 1 ? [] : undefined),
      );
    const ids = parsed[name].map((x) => x.id);
    if (new Set(ids).size !== ids.length) throw Error(`${name} 存在重复 ID`);
  }
  const has = (table: string, key: string) =>
    parsed[table].some((r) => r.id === key);
  if (root.version === 2) {
    const keys = parsed.categories.map((c) => `${c.system}:${c.name}`);
    if (new Set(keys).size !== keys.length) throw Error("分类存在重复名称");
    for (const table of ["gear", "items", "wishes", "expenses"])
      for (const row of parsed[table])
        if (
          row.categoryId &&
          !parsed.categories.some(
            (c) =>
              c.id === row.categoryId &&
              c.system === (table === "expenses" ? "expense" : "gear"),
          )
        )
          throw Error("分类关联缺失");
    for (const t of parsed.templates)
      for (const item of t.items)
        if (!item.gearId && !item.sourceId) throw Error("模板临时条目来源缺失");
  }
  for (const [table, rows] of Object.entries(parsed))
    for (const row of rows) {
      if (row.tripId && !has("trips", row.tripId))
        throw Error(`${table} 的行程关联缺失`);
      if (row.attachmentId && !has("attachments", row.attachmentId))
        throw Error("照片附件缺失");
      if (row.gearId && !has("gear", row.gearId)) throw Error("装备关联缺失");
      if (row.foodId && !has("foods", row.foodId)) throw Error("食物关联缺失");
      if (row.tripItemId && !has("items", row.tripItemId))
        throw Error("临时装备关联缺失");
      if (row.supplyId) {
        const sp = parsed.supplies.find((x) => x.id === row.supplyId);
        if (!sp || sp.tripId !== row.tripId || sp.day > row.day)
          throw Error("补给关联无效");
      }
      if (row.day) {
        const t = parsed.trips.find((x) => x.id === row.tripId);
        if (row.day > (Date.parse(t.end) - Date.parse(t.start)) / 86400000 + 1)
          throw Error("每日计划超出日期范围");
      }
    }
  return parsed;
}
export async function restoreBackup(input: unknown) {
  const data = validateBackup(input);
  await business(async () => {
    for (const table of db.tables.filter((t) => t.name !== "meta")) {
      await table.clear();
      await table.bulkAdd(data[table.name]);
    }
    await migrateData(
      Dexie.currentTransaction!,
      (input as { version: number }).version === 1,
    );
  });
}
let exporting = false;
export async function exportAndRecord(send = download) {
  if (exporting) throw Error("正在导出，请稍候");
  exporting = true;
  try {
    const snapshot = await db.transaction("r", db.tables, async () => ({
      backup: await exportBackup(),
      meta: (await db.meta.get("data")) || defaultMeta,
    }));
    send(
      `山行清单备份-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(snapshot.backup),
    );
    await db.transaction("rw", db.meta, async () => {
      const current = (await db.meta.get("data")) || defaultMeta;
      await db.meta.put({
        ...current,
        lastExport: new Date().toISOString(),
        changes: Math.max(0, current.changes - snapshot.meta.changes),
        snoozeUntil: 0,
      });
    });
  } finally {
    exporting = false;
  }
}
export function download(
  name: string,
  text: string,
  type = "application/json",
) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export function csv(name: string, rows: (string | number)[][]) {
  download(
    name,
    "\uFEFF" +
      rows
        .map((row) =>
          row
            .map(
              (v) =>
                '"' +
                String(v)
                  .replace(/^[=+@\-\t\r]/, "'$&")
                  .replaceAll('"', '""') +
                '"',
            )
            .join(","),
        )
        .join("\r\n"),
    "text/csv;charset=utf-8",
  );
}
