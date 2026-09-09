import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import {
  uid,
  days,
  mealTotal,
  shopping,
  supplyLoads,
  kg,
  money,
  type Trip,
  type Food,
  type Meal,
  type Supply,
} from "./model";
import { csv } from "./backup";
import { Add, Editor, Stat, Empty, txt, num, select, type Field } from "./ui";
const slots = ["早餐", "午餐", "晚餐", "加餐"];
const foodFields: Field[] = [
  txt("name", "食物名称", true),
  txt("spec", "规格"),
  num("weight", "每份重量（克）"),
  num("kcal", "每份热量（kcal）"),
  num("price", "每份价格（元）", 0, 0.01),
  { key: "cook", label: "需要烹煮", type: "checkbox" },
  num("water", "每份烹煮用水（毫升）"),
  { key: "notes", label: "备注", type: "textarea" },
];
export function Meals({
  trip,
  run,
}: {
  trip: Trip;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const foods = useLiveQuery(() => db.foods.toArray()) || [],
    meals =
      useLiveQuery(
        () => db.meals.where("tripId").equals(trip.id).toArray(),
        [trip.id],
      ) || [],
    supplies =
      useLiveQuery(
        () => db.supplies.where("tripId").equals(trip.id).toArray(),
        [trip.id],
      ) || [],
    ready =
      useLiveQuery(
        () => db.procurement.where("tripId").equals(trip.id).toArray(),
        [trip.id],
      ) || [];
  const [day, setDay] = useState(1),
    [foodEdit, setFoodEdit] = useState<Food | null | undefined>(),
    [mealEdit, setMealEdit] = useState<Meal | null | undefined>(),
    [supplyEdit, setSupplyEdit] = useState<Supply | null | undefined>(),
    [copy, setCopy] = useState<string>(),
    [showFoods, setShowFoods] = useState(false),
    [proc, setProc] = useState<{ foodId: string; ready: number }>();
  const total = mealTotal(meals),
    daily = mealTotal(meals.filter((m) => m.day === day)),
    shop = shopping(meals, ready),
    locked = trip.status === "已完成";
  return (
    <>
      <div className="stats">
        <Stat
          label="全程计划食物"
          value={kg(total.weight)}
          detail={`${Math.round(total.kcal)} kcal · ${money(total.price)} 预估费用`}
        />
        <Stat
          label={`第 ${day} 天热量`}
          value={`${Math.round(daily.kcal)} kcal`}
          detail={`自定目标 ${trip.target} · 差额 ${Math.round(daily.kcal - trip.target)} kcal`}
        />
        <Stat
          label="仍需备齐"
          value={`${shop.filter((s) => s.needed > 0).length} 种`}
          detail="实际支付请在费用页独立记录"
        />
      </div>
      <div className="toolbar">
        <button className="secondary" onClick={() => setShowFoods(!showFoods)}>
          {showFoods ? "收起食物库" : "管理食物库"}
        </button>
        {!locked && (
          <button className="secondary" onClick={() => setSupplyEdit(null)}>
            添加补给点
          </button>
        )}
        <span className="muted">
          热量为用户填写或估算，自定目标并非专业饮食建议。
        </span>
      </div>
      {showFoods && (
        <section className="panel">
          <div className="section-head">
            <h2>可复用食物库</h2>
            <Add onClick={() => setFoodEdit(null)}>添加食物</Add>
          </div>
          {foods.map((f) => (
            <div className="list-row" key={f.id}>
              <div className="grow">
                <h3>
                  {f.name} <small>{f.spec}</small>
                </h3>
                <p className="muted">
                  {f.weight} g · {f.kcal} kcal · {money(f.price)} / 份
                  {f.cook && ` · 烹煮用水 ${f.water} ml`}
                </p>
              </div>
              <button className="text-btn" onClick={() => setFoodEdit(f)}>
                编辑
              </button>
              <button
                className="text-btn danger"
                onClick={() => {
                  if (confirm("删除食物？已关联餐食的食物不能删除。"))
                    void run(async () => {
                      if (await db.meals.where("foodId").equals(f.id).count())
                        throw Error("食物已关联餐食，不能删除。");
                      await db.transaction(
                        "rw",
                        [db.foods, db.procurement],
                        async () => {
                          await db.procurement
                            .filter((p) => p.foodId === f.id)
                            .delete();
                          await db.foods.delete(f.id);
                        },
                      );
                    });
                }}
              >
                删除
              </button>
            </div>
          ))}
          {!foods.length && (
            <p className="muted">添加常吃的食物，之后可反复加入餐食。</p>
          )}
        </section>
      )}
      <div className="two-col">
        <section className="panel">
          <div className="section-head">
            <h2>每日餐食</h2>
            <select
              aria-label="选择餐食日期"
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
            >
              {Array.from({ length: days(trip) }, (_, i) => (
                <option key={i} value={i + 1}>
                  第 {i + 1} 天 ·{" "}
                  {new Date(Date.parse(trip.start) + i * 86400000)
                    .toISOString()
                    .slice(5, 10)}
                </option>
              ))}
            </select>
          </div>
          <div className="section-head">
            <p className="muted">
              当日 {kg(daily.weight)} · {money(daily.price)}
            </p>
            {!locked && (
              <button className="text-btn" onClick={() => setCopy("全天")}>
                复制这一天
              </button>
            )}
          </div>
          {slots.map((slot) => (
            <div className="meal-block" key={slot}>
              <div className="section-head">
                <h3>{slot}</h3>
                {!locked && (
                  <div className="row-actions">
                    <button className="text-btn" onClick={() => setCopy(slot)}>
                      复制
                    </button>
                    <button
                      className="text-btn"
                      onClick={() => setMealEdit({ slot } as Meal)}
                    >
                      ＋ 添加食物
                    </button>
                  </div>
                )}
              </div>
              {meals
                .filter((m) => m.day === day && m.slot === slot)
                .map((m) => (
                  <div className="meal-row" key={m.id}>
                    <div className="grow">
                      <strong>
                        {m.name} × {m.servings}
                      </strong>
                      <p className="muted">
                        {m.weight * m.servings} g · {m.kcal * m.servings} kcal ·{" "}
                        {money(m.price * m.servings)} ·{" "}
                        {supplies.find((s) => s.id === m.supplyId)?.name ||
                          "出发携带"}
                      </p>
                    </div>
                    {!locked && (
                      <>
                        <button
                          className="text-btn"
                          onClick={() => setMealEdit(m)}
                        >
                          编辑
                        </button>
                        <button
                          className="text-btn"
                          onClick={() => {
                            if (confirm("移除此餐食条目？"))
                              void run(() => db.meals.delete(m.id));
                          }}
                        >
                          移除
                        </button>
                      </>
                    )}
                  </div>
                ))}
              {!meals.some((m) => m.day === day && m.slot === slot) && (
                <p className="muted">尚未安排，给这段路补充一点能量。</p>
              )}
              <small className="muted">
                合计{" "}
                {kg(
                  mealTotal(
                    meals.filter((m) => m.day === day && m.slot === slot),
                  ).weight,
                )}{" "}
                ·{" "}
                {Math.round(
                  mealTotal(
                    meals.filter((m) => m.day === day && m.slot === slot),
                  ).kcal,
                )}{" "}
                kcal
              </small>
            </div>
          ))}
        </section>
        <aside>
          <section className="panel">
            <h2>携带与补给区间</h2>
            <p className="hint">
              补给在当天开始时领取。区间起始负重包含此前领取、尚未吃掉的食物。
            </p>
            {supplyLoads(meals, supplies, days(trip)).map((s) => (
              <div className="supply-row" key={s.id}>
                <div>
                  <h3>{s.name}</h3>
                  <small>
                    第 {s.day} — {s.endDay} 天 · 起始携带 {kg(s.carryWeight)} ·
                    本站领取 {kg(s.receiveWeight)}
                  </small>
                </div>
                {s.id && !locked && (
                  <button
                    className="text-btn"
                    onClick={() =>
                      setSupplyEdit(supplies.find((p) => p.id === s.id))
                    }
                  >
                    编辑
                  </button>
                )}
                {s.id && !locked && (
                  <button
                    className="text-btn"
                    onClick={() => {
                      if (
                        confirm("删除补给点？有餐食关联时需要先修改对应餐食。")
                      )
                        void run(async () => {
                          if (meals.some((m) => m.supplyId === s.id))
                            throw Error("请先调整该补给点关联的餐食");
                          await db.supplies.delete(s.id);
                        });
                    }}
                  >
                    移除
                  </button>
                )}
              </div>
            ))}
          </section>
          <section className="panel">
            <div className="section-head">
              <h2>采购清单</h2>
              <button
                className="text-btn"
                onClick={() =>
                  csv("餐食采购.csv", [
                    [
                      "食物",
                      "计划份数",
                      "已备齐",
                      "仍需采购",
                      "重量g",
                      "预估费用分",
                    ],
                    ...shop.map((s) => [
                      s.name,
                      s.servings,
                      s.ready,
                      s.needed,
                      s.weight,
                      s.price,
                    ]),
                  ])
                }
              >
                CSV
              </button>
            </div>
            {shop.map((s) => (
              <div className="shopping-row" key={s.foodId}>
                <div>
                  <h3>{s.name}</h3>
                  <small>
                    需 {s.servings} 份 · 已备 {s.ready} · 缺 {s.needed}
                  </small>
                </div>
                <button
                  className="secondary"
                  onClick={() => setProc({ foodId: s.foodId, ready: s.ready })}
                >
                  备齐数量
                </button>
              </div>
            ))}
            {!shop.length && (
              <p className="muted">安排餐食后自动生成，无需重复录入。</p>
            )}
          </section>
        </aside>
      </div>
      {foodEdit !== undefined && (
        <Editor
          title={foodEdit ? "编辑食物" : "添加食物"}
          fields={foodFields}
          initial={
            foodEdit ? { ...foodEdit, price: foodEdit.price / 100 } : undefined
          }
          onClose={() => setFoodEdit(undefined)}
          onSave={async (v) => {
            await db.foods.put({
              ...v,
              id: foodEdit?.id || uid(),
              price: Math.round(v.price * 100),
            });
          }}
        />
      )}
      {mealEdit !== undefined && (
        <Editor
          title={mealEdit?.id ? "编辑餐食" : "添加餐食"}
          fields={[
            select(
              "food",
              "食物",
              foods.map((f) => `${f.name} · ${f.id}`),
            ),
            select("slot", "餐次", slots),
            num("servings", "份数", 1, 0.1),
            select("supply", "获取方式", [
              "出发携带",
              ...supplies
                .filter((s) => s.day <= (mealEdit?.day || day))
                .map((s) => `${s.name} · ${s.id}`),
            ]),
          ]}
          initial={{
            ...mealEdit,
            food: mealEdit?.foodId
              ? `${foods.find((f) => f.id === mealEdit.foodId)?.name} · ${mealEdit.foodId}`
              : undefined,
            supply: mealEdit?.supplyId
              ? `${supplies.find((s) => s.id === mealEdit.supplyId)?.name} · ${mealEdit.supplyId}`
              : "出发携带",
          }}
          onClose={() => setMealEdit(undefined)}
          onSave={async (v) => {
            if (v.servings <= 0) throw Error("份数必须大于 0");
            const f = foods.find((f) => f.id === v.food.split(" · ").at(-1));
            if (!f) throw Error("请先在食物库添加食物");
            const same = mealEdit?.foodId === f.id;
            await db.meals.put({
              id: mealEdit?.id || uid(),
              tripId: trip.id,
              day: mealEdit?.day || day,
              slot: v.slot,
              foodId: f.id,
              name: same ? mealEdit!.name : f.name,
              weight: same ? mealEdit!.weight : f.weight,
              kcal: same ? mealEdit!.kcal : f.kcal,
              price: same ? mealEdit!.price : f.price,
              servings: v.servings,
              supplyId:
                v.supply === "出发携带" ? "" : v.supply.split(" · ").at(-1),
            });
          }}
        />
      )}
      {supplyEdit !== undefined && (
        <Editor
          title={supplyEdit ? "编辑途中补给" : "添加途中补给"}
          fields={[
            txt("name", "补给点名称", true),
            num("day", "第几天（当天开始补给）", 2),
          ]}
          initial={supplyEdit ?? undefined}
          onClose={() => setSupplyEdit(undefined)}
          onSave={async (v) => {
            if (v.day < 2 || v.day > days(trip))
              throw Error("补给日须在第 2 天至行程结束之间");
            if (
              supplies.some((s) => s.day === v.day && s.id !== supplyEdit?.id)
            )
              throw Error("同一天使用一个补给点，请合并安排");
            if (
              supplyEdit &&
              meals.some((m) => m.supplyId === supplyEdit.id && m.day < v.day)
            )
              throw Error("补给日期不能晚于关联餐食的食用日期");
            await db.supplies.put({
              ...v,
              id: supplyEdit?.id || uid(),
              tripId: trip.id,
            });
          }}
        />
      )}
      {copy && (
        <Editor
          title={`复制${copy}安排（追加到目标）`}
          fields={[
            num("target", "复制到第几天", Math.min(day + 1, days(trip))),
            ...(copy === "全天" ? [] : [select("slot", "目标餐次", slots)]),
          ]}
          onClose={() => setCopy(undefined)}
          onSave={async (v) => {
            if (v.target < 1 || v.target > days(trip))
              throw Error("目标日期超出行程");
            if (v.target === day && (copy === "全天" || v.slot === copy))
              throw Error("请选择不同日期或餐次");
            const source = meals.filter(
              (m) => m.day === day && (copy === "全天" || m.slot === copy),
            );
            if (!source.length) throw Error("来源没有餐食");
            await db.meals.bulkAdd(
              source.map((m) => ({
                ...m,
                id: uid(),
                day: v.target,
                slot: copy === "全天" ? m.slot : v.slot,
                supplyId:
                  supplies.find((s) => s.id === m.supplyId && s.day <= v.target)
                    ?.id || "",
              })),
            );
          }}
        />
      )}
      {proc && (
        <Editor
          title="更新备齐数量"
          fields={[num("ready", "已备齐份数", proc.ready, 0.1)]}
          onClose={() => setProc(undefined)}
          onSave={async (v) => {
            await db.procurement.put({
              id: `${trip.id}:${proc.foodId}`,
              tripId: trip.id,
              foodId: proc.foodId,
              ready: v.ready,
            });
          }}
        />
      )}
    </>
  );
}
