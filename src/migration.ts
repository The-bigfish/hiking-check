import type { Transaction } from "dexie";
import { categories, type Category, type CategorySystem } from "./model";
export const expenseCategories = [
  "交通",
  "住宿",
  "门票",
  "餐饮",
  "补给",
  "装备租赁",
  "装备购置",
  "其他",
];
export const iconNames = [
  "背包",
  "帐篷",
  "睡袋",
  "衣服",
  "鞋袜",
  "炊具",
  "水瓶",
  "照明",
  "导航通信",
  "医疗",
  "卫生",
  "电子设备",
  "其他",
];
export const defaultIcon = (name: string) =>
  iconNames[categories.indexOf(name)] || "其他";
export const categoryKey = (system: CategorySystem, name: string) =>
  `${system}:${encodeURIComponent(name.trim() || "其他")}`;
// Both the v2 database upgrade and legacy backup restoration use this conversion.
export async function migrateData(tx: Transaction, seedDefaults = true) {
  const table = tx.table("categories");
  const catalog: Category[] = await table.toArray();
  const ensure = async (system: CategorySystem, name: string) => {
    name = name.trim() || "其他";
    let c = catalog.find((c) => c.system === system && c.name === name);
    if (!c) {
      c = {
        id: categoryKey(system, name),
        system,
        name,
        icon: system === "gear" ? defaultIcon(name) : "其他",
        order: catalog.filter((c) => c.system === system).length,
        disabled: false,
      };
      catalog.push(c);
      await table.put(c);
    }
    return c;
  };
  if (seedDefaults) {
    for (const name of categories) await ensure("gear", name);
    for (const name of expenseCategories) await ensure("expense", name);
  }
  const link = async (row: any, system: CategorySystem) => {
    const c =
      catalog.find((c) => c.id === row.categoryId && c.system === system) ||
      (await ensure(system, row.category));
    row.categoryId = c.id;
  };
  for (const name of ["gear", "items", "wishes", "expenses"]) {
    for (const row of await tx.table(name).toArray()) {
      await link(row, name === "expenses" ? "expense" : "gear");
      if (name === "items") row.sourceId ??= `item:${row.id}`;
      if (row.previousItem) {
        await link(row.previousItem, "gear");
        row.previousItem.sourceId ??= `item:${row.previousItem.id}`;
      }
      await tx.table(name).put(row);
    }
  }
  for (const t of await tx.table("templates").toArray()) {
    t.notes ??= "";
    for (let n = 0; n < t.items.length; n++) {
      await link(t.items[n], "gear");
      t.items[n].sourceId ??= `template:${t.id}:${n}`;
    }
    await tx.table("templates").put(t);
  }
}
