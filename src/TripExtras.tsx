import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { uid, money, today, days, type Trip, type Expense } from "./model";
import { csv } from "./backup";
import { Add, Editor, Stat, Empty, txt, num, select, photo } from "./ui";
const cats = [
  "交通",
  "住宿",
  "门票",
  "餐饮",
  "补给",
  "装备租赁",
  "装备购置",
  "其他",
];
export function Expenses({
  trip,
  run,
}: {
  trip: Trip;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const expenses =
      useLiveQuery(
        () => db.expenses.where("tripId").equals(trip.id).toArray(),
        [trip.id],
      ) || [],
    gear = useLiveQuery(() => db.gear.toArray()) || [],
    attachments = useLiveQuery(() => db.attachments.toArray()) || [];
  const [edit, setEdit] = useState<Expense | null | undefined>();
  const total = expenses.reduce((a, e) => a + e.amount, 0);
  return (
    <>
      <div className="stats">
        <Stat
          label="行程预算"
          value={trip.budget === null ? "未设置" : money(trip.budget)}
          detail={
            trip.budget === null
              ? "可在行程设置中填写"
              : `剩余 ${money(trip.budget - total)}`
          }
        />
        <Stat
          label="实际支出"
          value={money(total)}
          detail="不包含计划餐食费用"
        />
        <Stat label="日均花费" value={money(Math.round(total / days(trip)))} />
      </div>
      <div className="two-col">
        <section className="panel">
          <div className="section-head">
            <h2>花费记录</h2>
            <Add onClick={() => setEdit(null)}>记一笔</Add>
          </div>
          {expenses
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((e) => (
              <div className="list-row" key={e.id}>
                {e.attachmentId && (
                  <img
                    className="receipt"
                    alt="支出凭证"
                    src={attachments.find((a) => a.id === e.attachmentId)?.data}
                  />
                )}
                <div className="grow">
                  <h3>{e.category}</h3>
                  <p className="muted">
                    {e.date} · {e.notes || "无备注"}
                    {e.gearId && " · 已关联装备"}
                  </p>
                </div>
                <strong>{money(e.amount)}</strong>
                <button className="text-btn" onClick={() => setEdit(e)}>
                  编辑
                </button>
                <button
                  className="text-btn danger"
                  onClick={() => {
                    if (confirm("删除这笔实际支出？"))
                      void run(() => db.expenses.delete(e.id));
                  }}
                >
                  删除
                </button>
              </div>
            ))}
          {!expenses.length && (
            <Empty
              title="还没有实际支出"
              detail="餐食计划只用于估算，付款后再记一笔。"
            />
          )}
          <button
            className="text-btn"
            onClick={() =>
              csv("行程开销.csv", [
                ["日期", "分类", "金额分", "备注"],
                ...expenses.map((e) => [e.date, e.category, e.amount, e.notes]),
              ])
            }
          >
            导出费用 CSV
          </button>
        </section>
        <section className="panel">
          <h2>分类占比</h2>
          {cats.map((c) => {
            const sum = expenses
              .filter((e) => e.category === c)
              .reduce((a, e) => a + e.amount, 0);
            return (
              sum > 0 && (
                <div className="expense-bar" key={c}>
                  <div className="section-head">
                    <span>{c}</span>
                    <span>
                      {money(sum)} ·{" "}
                      {total ? Math.round((sum / total) * 100) : 0}%
                    </span>
                  </div>
                  <div className="progress">
                    <span style={{ width: `${(sum / total) * 100}%` }} />
                  </div>
                </div>
              )
            );
          })}
          {total === 0 && <p className="muted">记录支出后展示分类构成。</p>}
        </section>
      </div>
      {edit !== undefined && (
        <Editor
          title={edit ? "编辑支出" : "记录实际支出"}
          fields={[
            num("amount", "实际金额（元）", 0, 0.01),
            select("category", "分类", cats),
            {
              key: "date",
              label: "支出日期",
              type: "date",
              required: true,
              value: today(),
            },
            { key: "notes", label: "备注", type: "textarea" },
            select("gear", "主动关联装备（金额仍需自行填写）", [
              "不关联",
              ...gear.map((g) => `${g.name} · ${g.id}`),
            ]),
            { key: "photo", label: "凭证照片（最大 5 MB）", type: "file" },
          ]}
          initial={
            edit
              ? {
                  ...edit,
                  amount: edit.amount / 100,
                  gear: edit.gearId
                    ? `${gear.find((g) => g.id === edit.gearId)?.name} · ${edit.gearId}`
                    : "不关联",
                }
              : undefined
          }
          onClose={() => setEdit(undefined)}
          onSave={async (v) => {
            const data = await photo(v.photo),
              attachmentId = data ? uid() : edit?.attachmentId;
            await db.transaction(
              "rw",
              [db.expenses, db.attachments],
              async () => {
                if (data)
                  await db.attachments.add({
                    id: attachmentId!,
                    data,
                    name: "费用凭证",
                  });
                await db.expenses.put({
                  id: edit?.id || uid(),
                  tripId: trip.id,
                  amount: Math.round(v.amount * 100),
                  category: v.category,
                  date: v.date,
                  notes: v.notes,
                  attachmentId,
                  gearId:
                    v.gear === "不关联"
                      ? undefined
                      : v.gear.split(" · ").at(-1),
                });
              },
            );
          }}
        />
      )}
    </>
  );
}
export function ReviewPanel({
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
    review = useLiveQuery(() => db.reviews.get(trip.id), [trip.id]);
  const [edit, setEdit] = useState(false);
  return (
    <div className="two-col">
      <section className="panel">
        <h2>装备使用复盘</h2>
        <p className="muted">每一次回顾，都是下一次轻装出发的起点。</p>
        {items.map((i) => (
          <div className="review-row" key={i.id}>
            <h3>{i.name}</h3>
            <div className="toolbar">
              <select
                aria-label={`${i.name}是否使用`}
                value={i.used || "未记录"}
                onChange={(e) =>
                  run(() => db.items.update(i.id, { used: e.target.value }))
                }
              >
                {["未记录", "使用了", "未使用"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                aria-label={`${i.name}使用体验`}
                value={i.rating || "未评价"}
                onChange={(e) =>
                  run(() => db.items.update(i.id, { rating: e.target.value }))
                }
              >
                {["未评价", "好用", "一般", "不好用"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <label className="check">
                <input
                  type="checkbox"
                  checked={!!i.replace}
                  onChange={(e) =>
                    run(() =>
                      db.items.update(i.id, { replace: e.target.checked }),
                    )
                  }
                />
                需要替换
              </label>
              {i.replace && (
                <button
                  className="text-btn"
                  onClick={() =>
                    run(async () => {
                      if (
                        await db.wishes
                          .filter(
                            (w) =>
                              w.reason === `复盘替换：${trip.name} / ${i.id}` &&
                              w.status === "待购买",
                          )
                          .count()
                      )
                        throw Error("已加入待购清单");
                      await db.wishes.add({
                        id: uid(),
                        name: i.name,
                        category: i.category,
                        brand: "",
                        model: "",
                        price: i.price,
                        weight: i.weight,
                        url: "",
                        priority: "普通",
                        reason: `复盘替换：${trip.name} / ${i.id}`,
                        status: "待购买",
                      });
                    })
                  }
                >
                  加入待购
                </button>
              )}
            </div>
          </div>
        ))}
        {!items.length && (
          <p className="muted">行程添加装备后，可在这里逐件复盘。</p>
        )}
      </section>
      <section className="panel">
        <div className="section-head">
          <h2>这一路的收获</h2>
          <button className="secondary" onClick={() => setEdit(true)}>
            编辑复盘
          </button>
        </div>
        <h3>路线心得</h3>
        <p className="prewrap">
          {review?.notes || "记录路况、营地体验和下次想改进的地方。"}
        </p>
        <hr />
        <h3>剩余食物</h3>
        <p className="prewrap">
          {review?.leftovers || "记录剩余食物及份数，用于调整下次采购。"}
        </p>
      </section>
      {edit && (
        <Editor
          title="行后复盘"
          fields={[
            { key: "notes", label: "路线心得", type: "textarea" },
            {
              key: "leftovers",
              label: "剩余食物、份数与餐食心得",
              type: "textarea",
            },
          ]}
          initial={review}
          onClose={() => setEdit(false)}
          onSave={async (v) => {
            await db.reviews.put({ ...v, id: trip.id, tripId: trip.id });
          }}
        />
      )}
    </div>
  );
}
