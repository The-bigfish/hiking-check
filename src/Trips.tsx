import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { MapPin, ArrowLeft, ArrowUpRight, CalendarDays } from "lucide-react";
import { db } from "./db";
import { uid, today, days, type Trip } from "./model";
import { copyTrip, deleteTrip, saveTrip } from "./services";
import {
  Heading,
  Add,
  Empty,
  Editor,
  num,
  txt,
  select,
  type Field,
} from "./ui";
import { Packing } from "./Packing";
import { Meals } from "./Meals";
import { Expenses, ReviewPanel } from "./TripExtras";
const fields: Field[] = [
  txt("name", "行程名称", true),
  txt("location", "地点"),
  {
    key: "start",
    label: "开始日期",
    type: "date",
    required: true,
    value: today(),
  },
  {
    key: "end",
    label: "结束日期",
    type: "date",
    required: true,
    value: today(),
  },
  num("distance", "距离（公里）", 0, 0.1),
  num("ascent", "累计爬升（米）"),
  txt("weather", "预计天气与温度"),
  { key: "route", label: "路线概要", type: "textarea" },
  txt("emergency", "紧急联系人及联系方式"),
  { key: "budget", label: "预算（元，可留空）", type: "number", step: 0.01 },
  num("target", "自定每日热量目标（kcal）", 2500),
  select("status", "行程状态", ["计划中", "进行中", "已完成"]),
];
export function Trips({
  selected,
  onSelect,
  run,
}: {
  selected: string;
  onSelect: (s: string) => void;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const trips =
      useLiveQuery(() => db.trips.orderBy("start").reverse().toArray()) || [],
    [edit, setEdit] = useState<Trip | null | undefined>(),
    [tab, setTab] = useState("路线");
  const t = trips.find((t) => t.id === selected);
  return (
    <>
      {t ? (
        <>
          <button className="text-btn back" onClick={() => onSelect("")}>
            <ArrowLeft size={16} />
            全部行程
          </button>
          <Heading
            eyebrow="A LITTLE FURTHER, A LITTLE FREER"
            title={t.name}
            description={`${t.location} · ${t.start} — ${t.end} · ${days(t)} 天`}
            action={
              <button className="secondary" onClick={() => setEdit(t)}>
                编辑行程
              </button>
            }
          />
          <div className="trip-summary">
            <span>
              <MapPin size={18} />
              {t.distance} km
            </span>
            <span>↗ {t.ascent} m 爬升</span>
            <span>{t.weather || "天气待填写"}</span>
            <span className="badge">{t.status}</span>
          </div>
          <div className="tabs">
            {["路线", "打包", "餐食", "费用", "复盘"].map((s) => (
              <button
                key={s}
                className={tab === s ? "active" : ""}
                onClick={() => setTab(s)}
              >
                {s}
              </button>
            ))}
          </div>
          {tab === "路线" ? (
            <Route trip={t} run={run} />
          ) : tab === "打包" ? (
            <Packing trip={t} run={run} />
          ) : tab === "餐食" ? (
            <Meals trip={t} run={run} />
          ) : tab === "费用" ? (
            <Expenses trip={t} run={run} />
          ) : (
            <ReviewPanel trip={t} run={run} />
          )}
        </>
      ) : (
        <>
          <Heading
            eyebrow="EVERY TRAIL STARTS WITH A PLAN"
            title="我的行程"
            description="从地图上的一个念头，到山野间的一段记忆。"
            action={<Add onClick={() => setEdit(null)}>新建行程</Add>}
          />
          <div className="trip-grid">
            {trips.map((t, index) => (
              <article className="trip-card" key={t.id}>
                <button
                  className={`trip-art art-${index % 3}`}
                  onClick={() => {
                    setTab("路线");
                    onSelect(t.id);
                  }}
                  aria-label={`打开${t.name}`}
                >
                  <div className="landscape">
                    <i />
                    <i />
                    <i />
                  </div>
                  <span className="badge">{t.status}</span>
                  <span className="trip-art-title">
                    山野有期<small>INTO THE WILD</small>
                  </span>
                  <ArrowUpRight />
                </button>
                <div className="trip-card-body">
                  <h2>
                    <button className="text-btn" onClick={() => onSelect(t.id)}>
                      {t.name}
                    </button>
                  </h2>
                  <p className="muted">
                    <MapPin size={14} />
                    {t.location || "地点待定"} · {t.distance} km · {days(t)} 天
                  </p>
                  <p className="muted">
                    <CalendarDays size={14} />
                    {t.start} — {t.end}
                  </p>
                  <div className="row-actions">
                    <button
                      onClick={() => {
                        setTab("打包");
                        onSelect(t.id);
                      }}
                    >
                      检查清单
                    </button>
                    <button
                      className="text-btn"
                      onClick={() =>
                        run(async () => onSelect(await copyTrip(t.id)))
                      }
                    >
                      复制行程
                    </button>
                    <button
                      className="text-btn danger"
                      onClick={() => {
                        if (
                          confirm(
                            "删除行程及其餐食、开销、复盘？此操作不可撤销。",
                          )
                        )
                          void run(() => deleteTrip(t.id));
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!trips.length && (
            <Empty
              title="下一站，想去哪里？"
              detail="创建一次行程，开始安排装备、餐食和路线。"
              action={<Add onClick={() => setEdit(null)}>新建行程</Add>}
            />
          )}
        </>
      )}
      {edit !== undefined && (
        <Editor
          title={edit ? "编辑行程" : "新建行程"}
          fields={fields}
          initial={
            edit
              ? {
                  ...edit,
                  budget: edit.budget === null ? "" : edit.budget / 100,
                }
              : undefined
          }
          onClose={() => setEdit(undefined)}
          onSave={async (v) => {
            if (v.end < v.start) throw Error("结束日期不能早于开始日期");
            if (days(v) > 366) throw Error("单次行程最多支持 366 天");
            const id = edit?.id || uid();
            await saveTrip({
              ...v,
              id,
              budget: v.budget === null ? null : Math.round(v.budget * 100),
            });
            if (!edit) onSelect(id);
          }}
        />
      )}
    </>
  );
}
function Route({
  trip,
  run,
}: {
  trip: Trip;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const daily =
      useLiveQuery(
        () => db.daily.where("tripId").equals(trip.id).toArray(),
        [trip.id],
      ) || [],
    [day, setDay] = useState<number>();
  return (
    <div className="two-col">
      <section className="panel">
        <div className="section-head">
          <h2>每日路线</h2>
          <span className="muted">{days(trip)} 天的山野计划</span>
        </div>
        {Array.from({ length: days(trip) }, (_, i) => i + 1).map((d) => {
          const p = daily.find((x) => x.day === d);
          return (
            <article className="day-row" key={d}>
              <span className="day-number">D{d}</span>
              <div className="grow">
                <h3>
                  {p
                    ? `${p.start || "起点待定"} → ${p.end || "终点待定"}`
                    : "当天路线待规划"}
                </h3>
                <p className="muted">
                  营地：{p?.camp || "未设置"} · 补水：{p?.water || "未设置"}
                </p>
                {p?.resupply && <p className="muted">补给说明：{p.resupply}</p>}
                {p?.notes && <p>{p.notes}</p>}
              </div>
              <button className="secondary" onClick={() => setDay(d)}>
                编辑
              </button>
              {p && (
                <button
                  className="text-btn"
                  onClick={() => {
                    if (confirm("删除这一天的路线安排？"))
                      void run(() => db.daily.delete(p.id));
                  }}
                >
                  移除
                </button>
              )}
            </article>
          );
        })}
      </section>
      <aside>
        <section className="panel">
          <h2>路线概要</h2>
          <p className="prewrap">{trip.route || "还没有填写路线概要。"}</p>
          <hr />
          <h3>紧急联系</h3>
          <p>{trip.emergency || "请在行程设置中填写紧急联系人。"}</p>
          <p className="muted">
            出发前将计划告知可信任的人，并提前核实沿途补水与补给条件。
          </p>
        </section>
      </aside>
      {day && (
        <Editor
          title={`第 ${day} 天路线`}
          fields={[
            txt("start", "起点"),
            txt("end", "终点"),
            txt("camp", "营地"),
            txt("water", "补水点"),
            txt("resupply", "补给点说明"),
            { key: "notes", label: "必要备注", type: "textarea" },
          ]}
          initial={daily.find((d) => d.day === day)}
          onClose={() => setDay(undefined)}
          onSave={async (v) => {
            await db.daily.put({
              ...v,
              id: daily.find((d) => d.day === day)?.id || uid(),
              tripId: trip.id,
              day,
            });
          }}
        />
      )}
    </div>
  );
}
