import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check } from "lucide-react";
import { db } from "./db";
import { uid, weights, kg, type Trip, type Item } from "./model";
import { Add, Stat, Editor, Empty, select } from "./ui";
import { GearPicker } from "./GearPicker";
import { GearImage } from "./GearImage";
import { TemplateApply, itemFields } from "./Templates";
import { SyncGear } from "./SyncGear";
import {
  addGearBatch,
  templateFromTrip,
  packItems,
  undoPack,
  cycleItem,
  gearDifferences,
  type PackOperation,
} from "./packingService";
export function Packing({
  trip,
  run,
}: {
  trip: Trip;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const items =
      useLiveQuery(
        () => db.items.where("tripId").equals(trip.id).toArray(),
        [trip.id],
      ) || [],
    meals =
      useLiveQuery(
        () => db.meals.where("tripId").equals(trip.id).toArray(),
        [trip.id],
      ) || [],
    gear = useLiveQuery(() => db.gear.toArray()) || [];
  const [edit, setEdit] = useState<Item | null | undefined>(),
    [picker, setPicker] = useState(false),
    [template, setTemplate] = useState(false),
    [sync, setSync] = useState(false),
    [filter, setFilter] = useState("全部"),
    [category, setCategory] = useState("全部"),
    [operations, setOperations] = useState<
      (PackOperation & { expires: number })[]
    >([]);
  useEffect(() => {
    if (!operations.length) return;
    const timer = setTimeout(
      () => setOperations((ops) => ops.filter((o) => o.expires > Date.now())),
      Math.max(0, Math.min(...operations.map((o) => o.expires)) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [operations]);
  const w = weights(items, meals),
    packed = items.filter((i) => i.state === "已装包").length,
    locked = trip.status === "已完成";
  const visible = items.filter(
    (i) =>
      (category === "全部" || i.category === category) &&
      (filter === "全部" ||
        (i.state !== "已装包" && (filter !== "必带遗漏" || i.required))),
  );
  const packable = visible.filter((i) => i.state !== "已装包");
  const differences = gearDifferences(items, gear);
  const pack = (ids: string[]) =>
    run(async () => {
      const op = await packItems(trip.id, ids);
      if (op.entries.length)
        setOperations((ops) => [...ops, { ...op, expires: Date.now() + 6000 }]);
    });
  return (
    <>
      <div className="stats weight-stats">
        <Stat
          label="预计出发背包"
          value={kg(w.total)}
          detail="基础 + 消耗品 + 出发食物 + 水"
        />
        <Stat label="基础背包" value={kg(w.base)} />
        <Stat label="食物 / 其他消耗品" value={kg(w.food + w.consumable)} />
        <Stat label="饮水 / 穿戴" value={`${kg(w.water)} / ${kg(w.worn)}`} />
      </div>
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>行前打包检查</h2>
            <p className="muted">
              {packed} / {items.length} 已装包 ·{" "}
              {items.filter((i) => i.required && i.state !== "已装包").length}{" "}
              件必带未装包
            </p>
          </div>
          <strong className="progress-value">
            {items.length ? Math.round((packed / items.length) * 100) : 0}%
          </strong>
        </div>
        <div className="progress">
          <span
            style={{
              width: `${items.length ? (packed / items.length) * 100 : 0}%`,
            }}
          />
        </div>
        {trip.status === "计划中" &&
          (differences.diffs.length > 0 ||
            differences.unavailable.length > 0) && (
            <div className="notice">
              <span>
                {differences.diffs.length
                  ? "有装备信息更新，查看并同步。"
                  : "关联装备已归档或不存在，当前快照保留。"}
              </span>
              <button onClick={() => setSync(true)}>查看并同步</button>
            </div>
          )}
        <div className="toolbar">
          <select
            aria-label="检查筛选"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {["全部", "未装包", "必带遗漏"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="打包分类"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {["全部", ...new Set(items.map((i) => i.category))].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {!locked && (
            <>
              <Add onClick={() => setPicker(true)}>从装备库添加</Add>
              <button className="secondary" onClick={() => setEdit(null)}>
                临时物品
              </button>
              <button className="secondary" onClick={() => setTemplate(true)}>
                使用模板
              </button>
            </>
          )}
          <button
            className="text-btn"
            onClick={() => {
              const name = prompt("保存为模板名称");
              if (name?.trim())
                void run(() => templateFromTrip(trip.id, name.trim()));
            }}
          >
            保存为模板
          </button>
          {!locked && (
            <>
              <button
                className="secondary"
                disabled={!packable.length}
                onClick={() => {
                  if (
                    confirm(
                      `将当前筛选结果中 ${packable.length} 项全部装包？不会修改筛选外条目，可在 6 秒内撤销。`,
                    )
                  )
                    void pack(packable.map((i) => i.id));
                }}
              >
                全部装包（当前筛选 {packable.length} 项）
              </button>
              <button
                className="text-btn danger"
                onClick={() => {
                  if (
                    confirm(
                      "将整个行程的所有条目重置为待准备？包括筛选外条目。",
                    )
                  )
                    void run(() =>
                      db.items
                        .where("tripId")
                        .equals(trip.id)
                        .filter((i) => i.state !== "待准备")
                        .modify({ state: "待准备", stateToken: uid() }),
                    );
                }}
              >
                重置检查
              </button>
            </>
          )}
        </div>
        <p className="hint">
          公共装备填写本人实际携带数量。食物在「餐食」录入自动计重；此处消耗品用于燃料等其他物品。
        </p>
        {locked && (
          <p className="notice">已完成行程的打包快照已锁定，复盘仍可编辑。</p>
        )}
        {visible.map((i) => (
          <div className="pack-row" key={i.id}>
            <button
              disabled={locked}
              className={`pack-check ${i.state === "已装包" ? "checked" : ""}`}
              aria-label={`${i.name}：${i.state}，点击切换`}
              onClick={() => run(() => cycleItem(trip.id, i.id))}
            >
              {i.state === "已装包" ? (
                <Check />
              ) : i.state === "已准备" ? (
                "·"
              ) : (
                ""
              )}
            </button>
            <GearImage {...i} />
            <div className="grow">
              <h3>
                {i.name} {i.required && <span className="required">必带</span>}
              </h3>
              <p className="muted">
                {i.category} · {i.carry} · {i.state}
                {i.notes && ` · ${i.notes}`}
              </p>
            </div>
            <div className="align-right">
              <strong>{kg(i.weight * i.quantity)}</strong>
              <small>
                {i.weight} g × {i.quantity}
              </small>
            </div>
            {!locked && (
              <>
                <button
                  disabled={i.state === "已装包"}
                  className="pack-direct"
                  aria-label={`装包 ${i.name}`}
                  onClick={() => pack([i.id])}
                >
                  {i.state === "已装包" ? "已装包" : "装包"}
                </button>
                <button className="text-btn" onClick={() => setEdit(i)}>
                  编辑
                </button>
                <button
                  className="text-btn danger"
                  onClick={() => {
                    if (confirm("移除此清单条目？"))
                      void run(async () => {
                        await db.wishes
                          .filter((w) => w.tripItemId === i.id)
                          .modify({
                            tripItemId: undefined,
                            previousItem: undefined,
                          });
                        await db.items.delete(i.id);
                      });
                  }}
                >
                  移除
                </button>
              </>
            )}
          </div>
        ))}
        {!items.length && (
          <Empty
            title="把安心装进背包"
            detail="添加已有装备，或从常用模板开始。"
          />
        )}
      </section>
      {edit !== undefined && (
        <Editor
          title={edit ? "编辑清单条目" : "添加临时物品"}
          fields={[
            ...itemFields,
            select("state", "检查状态", ["待准备", "已准备", "已装包"]),
          ]}
          initial={edit ? { ...edit, price: edit.price / 100 } : undefined}
          onClose={() => setEdit(undefined)}
          onSave={async (v) => {
            const latest = await db.trips.get(trip.id);
            if (latest?.status === "已完成")
              throw Error("行程已完成，不能修改");
            if (v.quantity <= 0) throw Error("数量须大于 0");
            await db.items.put({
              ...edit,
              ...v,
              id: edit?.id || uid(),
              sourceId: edit?.sourceId || uid(),
              stateToken: edit?.state === v.state ? edit?.stateToken : uid(),
              tripId: trip.id,
              price: Math.round(v.price * 100),
            });
          }}
        />
      )}
      {picker && (
        <GearPicker
          existingIds={items.flatMap((i) => (i.gearId ? [i.gearId] : []))}
          onClose={() => setPicker(false)}
          onAdd={(ids) => addGearBatch(trip.id, ids)}
        />
      )}{" "}
      {template && (
        <TemplateApply tripId={trip.id} onClose={() => setTemplate(false)} />
      )}{" "}
      {sync && <SyncGear tripId={trip.id} onClose={() => setSync(false)} />}
      <div className="undo-stack" aria-live="polite">
        {operations.map((op) => (
          <div className="undo-toast" key={op.id}>
            <span>
              已装包 ·{" "}
              {op.entries.length === 1
                ? items.find((i) => i.id === op.entries[0].id)?.name || "1 项"
                : `${op.entries.length} 项`}
            </span>
            <button
              aria-label={`撤销装包 ${op.entries.map((e) => items.find((i) => i.id === e.id)?.name).join("、")}`}
              onClick={() =>
                run(async () => {
                  await undoPack(op);
                  setOperations((ops) => ops.filter((o) => o.id !== op.id));
                })
              }
            >
              撤销
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
