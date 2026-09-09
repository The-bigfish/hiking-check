import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, Plus } from "lucide-react";
import { db } from "./db";
import { uid, weights, kg, type Trip, type Item } from "./model";
import { snapshot } from "./services";
import { Add, Stat, Editor, Empty, txt, num, select, type Field } from "./ui";
const fields: Field[] = [
  txt("name", "物品名称", true),
  txt("category", "分类", true),
  num("quantity", "本人实际携带数量", 1, 0.1),
  num("weight", "单件重量（克）"),
  num("price", "单价（元）", 0, 0.01),
  { key: "required", label: "必带物品", type: "checkbox", value: true },
  select("carry", "携带方式", ["背包内", "穿戴", "公共装备"]),
  select("kind", "重量类别", ["非消耗品", "消耗品", "饮水"]),
  select("state", "检查状态", ["待准备", "已准备", "已装包"]),
  { key: "notes", label: "备注", type: "textarea" },
];
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
    gear =
      useLiveQuery(() =>
        db.gear.filter((g) => !g.archived && g.status === "正常").toArray(),
      ) || [],
    templates = useLiveQuery(() => db.templates.toArray()) || [];
  const [edit, setEdit] = useState<Item | null | undefined>(),
    [picker, setPicker] = useState(false),
    [template, setTemplate] = useState(false),
    [filter, setFilter] = useState("全部"),
    [category, setCategory] = useState("全部");
  const w = weights(items, meals),
    packed = items.filter((i) => i.state === "已装包").length,
    locked = trip.status === "已完成";
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
                void run(() =>
                  db.templates.add({
                    id: uid(),
                    name: name.trim(),
                    items: items.map(({ id, tripId, ...i }) => ({
                      ...i,
                      state: "待准备",
                      used: undefined,
                      rating: undefined,
                      replace: false,
                    })),
                  }),
                );
            }}
          >
            保存为模板
          </button>
          {!locked && (
            <button
              className="text-btn danger"
              onClick={() => {
                if (confirm("将所有条目重置为待准备？"))
                  void run(() =>
                    db.items
                      .where("tripId")
                      .equals(trip.id)
                      .modify({ state: "待准备" }),
                  );
              }}
            >
              重置检查
            </button>
          )}
        </div>
        <p className="hint">
          公共装备填写本人实际携带的数量。餐食请在「餐食」页录入，自动计重；此处的消耗品用于燃料等其他物品。
        </p>
        {locked && (
          <p className="notice">已完成行程的打包快照已锁定，复盘仍可编辑。</p>
        )}
        {items
          .filter(
            (i) =>
              (category === "全部" || i.category === category) &&
              (filter === "全部" ||
                (i.state !== "已装包" &&
                  (filter !== "必带遗漏" || i.required))),
          )
          .map((i) => (
            <div className="pack-row" key={i.id}>
              <button
                disabled={locked}
                className={`pack-check ${i.state === "已装包" ? "checked" : ""}`}
                aria-label={`${i.name}：${i.state}，点击切换`}
                onClick={() =>
                  run(() =>
                    db.items.update(i.id, {
                      state:
                        i.state === "待准备"
                          ? "已准备"
                          : i.state === "已准备"
                            ? "已装包"
                            : "待准备",
                    }),
                  )
                }
              >
                {i.state === "已装包" ? (
                  <Check />
                ) : i.state === "已准备" ? (
                  "·"
                ) : (
                  ""
                )}
              </button>
              <div className="grow">
                <h3>
                  {i.name}{" "}
                  {i.required && <span className="required">必带</span>}
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
                  <button className="text-btn" onClick={() => setEdit(i)}>
                    编辑
                  </button>
                  <button
                    className="text-btn danger"
                    onClick={() => {
                      if (confirm("移除此清单条目？"))
                        void run(async () => {
                          await db.transaction(
                            "rw",
                            [db.items, db.wishes],
                            async () => {
                              await db.wishes
                                .filter((w) => w.tripItemId === i.id)
                                .modify({
                                  tripItemId: undefined,
                                  previousItem: undefined,
                                });
                              await db.items.delete(i.id);
                            },
                          );
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
          fields={fields}
          initial={edit ? { ...edit, price: edit.price / 100 } : undefined}
          onClose={() => setEdit(undefined)}
          onSave={async (v) => {
            await db.items.put({
              ...edit,
              ...v,
              id: edit?.id || uid(),
              tripId: trip.id,
              price: Math.round(v.price * 100),
            });
          }}
        />
      )}
      {picker && (
        <Editor
          title="从装备库添加"
          fields={[
            select(
              "gear",
              "选择装备",
              gear.map((g) => `${g.name} · ${g.id}`),
            ),
            num("quantity", "本人携带数量", 1, 0.1),
          ]}
          onClose={() => setPicker(false)}
          onSave={async (v) => {
            const g = gear.find((g) => g.id === v.gear.split(" · ").at(-1));
            if (!g) throw Error("请先在装备库添加正常状态装备");
            await db.items.add({
              ...snapshot(g, trip.id),
              quantity: v.quantity,
            });
          }}
        />
      )}
      {template && (
        <Editor
          title="使用装备模板"
          fields={[
            select(
              "template",
              "选择模板",
              templates.map((t) => `${t.name} · ${t.id}`),
            ),
          ]}
          onClose={() => setTemplate(false)}
          onSave={async (v) => {
            const t = templates.find(
              (t) => t.id === v.template.split(" · ").at(-1),
            );
            if (!t) throw Error("请先将行程清单保存为模板");
            await db.items.bulkAdd(
              t.items.map((i) => ({
                ...i,
                id: uid(),
                tripId: trip.id,
                state: "待准备",
              })),
            );
          }}
        />
      )}
    </>
  );
}
