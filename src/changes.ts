import Dexie, { type Transaction } from "dexie";
import { db } from "./db";
import type { DataMeta } from "./model";
export const defaultMeta: DataMeta = {
  id: "data",
  changes: 0,
  lastExport: null,
  threshold: 30,
  snoozeUntil: 0,
};
type TrackedTransaction = Transaction & {
  businessTracking?: boolean;
  effectiveChange?: boolean;
};
function root(tx: Transaction): TrackedTransaction {
  while (tx.parent) tx = tx.parent;
  return tx;
}
for (const table of db.tables.filter((t) => t.name !== "meta")) {
  table.hook("creating", function (_key, _obj, tx) {
    const t = root(tx);
    if (t.businessTracking) t.effectiveChange = true;
  });
  table.hook("deleting", function (_key, _obj, tx) {
    const t = root(tx);
    if (t.businessTracking) t.effectiveChange = true;
  });
  table.hook("updating", function (mods, objKey, obj, tx) {
    const t = root(tx);
    if (
      t.businessTracking &&
      Object.entries(mods).some(
        ([k, v]) =>
          JSON.stringify(Dexie.getByKeyPath(obj, k)) !== JSON.stringify(v),
      )
    )
      t.effectiveChange = true;
  });
}
// Each user action has one atomic transaction, including its modification counter.
// Non-database work (such as FileReader) uses Dexie.waitFor at that boundary.
export async function business<T>(fn: () => Promise<T>): Promise<T> {
  const existing = Dexie.currentTransaction;
  if (existing && root(existing).businessTracking) return fn();
  return db.transaction("rw", db.tables, async (tx) => {
    const tracked = root(tx);
    tracked.businessTracking = true;
    const result = await fn();
    if (tracked.effectiveChange) {
      const meta = (await db.meta.get("data")) || defaultMeta;
      await db.meta.put({ ...meta, changes: meta.changes + 1 });
    }
    return result;
  });
}
export async function setBackupThreshold(threshold: number) {
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 10000)
    throw Error("提醒阈值须为 1—10000 的整数");
  await db.transaction("rw", db.meta, async () => {
    await db.meta.put({
      ...defaultMeta,
      ...(await db.meta.get("data")),
      threshold,
    });
  });
}
export async function snoozeBackup() {
  await db.transaction("rw", db.meta, async () => {
    await db.meta.put({
      ...defaultMeta,
      ...(await db.meta.get("data")),
      snoozeUntil: Date.now() + 24 * 60 * 60 * 1000,
    });
  });
}
