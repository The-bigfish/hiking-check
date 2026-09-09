import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowUpRight,
  Compass,
  Backpack,
  ShoppingBag,
  Check,
  MapPin,
} from "lucide-react";
import { db } from "./db";
import { today, kg, money, weights, shopping, days } from "./model";
import { Heading, Stat, LinkButton, Empty } from "./ui";
export function Home({
  go,
  openTrip,
  demo,
}: {
  go: (s: string) => void;
  openTrip: (id: string) => void;
  demo: () => void;
}) {
  const data = useLiveQuery(async () => ({
    trips: await db.trips.toArray(),
    gear: await db.gear.toArray(),
    items: await db.items.toArray(),
    meals: await db.meals.toArray(),
    ready: await db.procurement.toArray(),
    expenses: await db.expenses.toArray(),
    wishes: await db.wishes.toArray(),
  }));
  if (!data) return <p role="status">正在读取本机数据…</p>;
  const { trips, gear, items, meals, ready, expenses, wishes } = data;
  const trip = trips
    .filter((t) => t.status !== "已完成")
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  const its = items.filter((i) => i.tripId === trip?.id),
    ms = meals.filter((m) => m.tripId === trip?.id),
    missing = its.filter((i) => i.required && i.state !== "已装包"),
    shop = shopping(
      ms,
      ready.filter((r) => r.tripId === trip?.id),
    ),
    packed = its.filter((i) => i.state === "已装包").length,
    w = weights(its, ms),
    spent = expenses
      .filter((e) => e.tripId === trip?.id)
      .reduce((a, e) => a + e.amount, 0);
  return (
    <>
      <Heading
        eyebrow="LESS WORRY. MORE WANDER."
        title="准备好，去山里。"
        description="把琐碎留在清单，把心思交给山野。"
        action={
          <button onClick={() => go("行程")}>
            <Compass size={18} />
            规划行程
          </button>
        }
      />
      <div className="home-layout">
        <section className="hero">
          <div className="hero-landscape">
            <div className="sun" />
            <i />
            <i />
            <i />
            <svg viewBox="0 0 600 280" preserveAspectRatio="none">
              <path
                d="M400 280Q200 250 320 208T365 168T390 132"
                fill="none"
                stroke="#edddab"
                strokeWidth="3"
                strokeDasharray="5 6"
              />
            </svg>
          </div>
          <div className="hero-content">
            <span className="hero-label">
              {trip
                ? "下一次出发 / NEXT ADVENTURE"
                : "山野，从这里开始 / YOUR NEXT ADVENTURE"}
            </span>
            <h2>{trip?.name || "心有所向，山野可往"}</h2>
            <p>
              <MapPin size={15} />
              {trip
                ? `${trip.location} · ${days(trip)} 天 ${trip.distance} km`
                : "建立属于自己的徒步清单"}
            </p>
            <p className="hero-date">
              {trip
                ? `${trip.start} — ${trip.end}`
                : "装备 · 路线 · 餐食 · 回忆"}
            </p>
            <button onClick={() => (trip ? openTrip(trip.id) : go("行程"))}>
              {trip ? "继续准备行程" : "规划第一次出发"}
              <ArrowUpRight size={18} />
            </button>
          </div>
          <span className="hero-coordinate">
            TAKE ONLY MEMORIES
            <br />
            LEAVE ONLY FOOTPRINTS
          </span>
        </section>
        <section className="panel departure">
          <div className="section-head">
            <h2>出发准备</h2>
            <span className="badge">{trip ? "进行中" : "待开始"}</span>
          </div>
          <div
            className="progress-ring"
            style={{
              background: `conic-gradient(#315b47 ${its.length ? (packed / its.length) * 100 : 0}%, #e9ece1 0)`,
            }}
          >
            <div>
              <strong>
                {its.length ? Math.round((packed / its.length) * 100) : 0}
                <small>%</small>
              </strong>
              <span>装备已装包</span>
            </div>
          </div>
          <div className="section-head">
            <span className="muted">
              {packed} / {its.length} 件装备
            </span>
            <strong>{kg(w.total)}</strong>
          </div>
          <hr />
          <p>
            <span className="orange-dot" />
            {missing.length} 件必带物品未装包
          </p>
          <p>
            <span className="orange-dot" />
            {shop.filter((s) => s.needed > 0).length} 种食物未备齐
          </p>
          <LinkButton onClick={() => (trip ? openTrip(trip.id) : go("行程"))}>
            检查行前清单
          </LinkButton>
        </section>
      </div>
      <div className="stats home-stats">
        <Stat
          label="我的装备"
          value={`${gear.filter((g) => !g.archived).reduce((a, g) => a + g.quantity, 0)} 件`}
          detail="妥善整理，随时出发"
        />
        <Stat
          label="累计行程"
          value={`${trips.length} 次`}
          detail={`${trips.filter((t) => t.status === "已完成").length} 次已完成`}
        />
        <Stat
          label="当前行程支出"
          value={money(spent)}
          detail={
            trip?.budget != null
              ? `预算 ${money(trip.budget)} · 剩余 ${money(trip.budget - spent)}`
              : "未设置预算"
          }
        />
        <Stat
          label="跨行程累计支出"
          value={money(expenses.reduce((a, e) => a + e.amount, 0))}
          detail="仅统计实际记账"
        />
      </div>
      <div className="two-col">
        <section className="panel">
          <div className="section-head">
            <h2>出发前，再看一眼</h2>
            <LinkButton onClick={() => (trip ? openTrip(trip.id) : go("行程"))}>
              查看全部
            </LinkButton>
          </div>
          {missing.slice(0, 4).map((i) => (
            <div className="todo-row" key={i.id}>
              <div className="todo-icon">
                <Backpack size={19} />
              </div>
              <div className="grow">
                <h3>{i.name}</h3>
                <p className="muted">
                  {i.category} · {i.state}
                </p>
              </div>
              <span className="badge warm">必带未装包</span>
            </div>
          ))}
          {!missing.length && (
            <div className="calm">
              <Check />
              <p>
                {trip
                  ? "清单中的必带装备均已装包。"
                  : "创建行程后，这里会提醒必带遗漏。"}
              </p>
            </div>
          )}
          {gear
            .filter(
              (g) => !g.archived && g.maintenance && g.maintenance <= today(),
            )
            .map((g) => (
              <div className="todo-row" key={g.id}>
                <div className="todo-icon">↻</div>
                <div className="grow">
                  <h3>{g.name}</h3>
                  <p className="muted">保养到期：{g.maintenance}</p>
                </div>
                <button className="text-btn" onClick={() => go("装备")}>
                  去维护
                </button>
              </div>
            ))}
        </section>
        <section className="panel">
          <div className="section-head">
            <h2>为下一程添置</h2>
            <LinkButton onClick={() => go("待购")}>待购清单</LinkButton>
          </div>
          {wishes
            .filter((w) => w.status === "待购买")
            .slice(0, 3)
            .map((w) => (
              <div className="todo-row" key={w.id}>
                <div className="todo-icon">
                  <ShoppingBag size={19} />
                </div>
                <div className="grow">
                  <h3>{w.name}</h3>
                  <p className="muted">{w.reason}</p>
                </div>
                <strong>{money(w.price)}</strong>
              </div>
            ))}
          {!wishes.some((w) => w.status === "待购买") && (
            <p className="muted">没有待购装备。带上已有的，也能走得很远。</p>
          )}
          <div className="field-note">
            <p className="eyebrow">A NOTE FROM THE TRAIL</p>
            <p>最好的装备，是你了解并信任的装备。</p>
            <small>出发前试用，回来后复盘。</small>
          </div>
        </section>
      </div>
      {!gear.length && !trips.length && !wishes.length && (
        <section className="welcome panel">
          <div>
            <h2>欢迎使用山行清单</h2>
            <p className="muted">
              你可以从空白开始，也可以自愿加载中文演示数据，体验完整流程。
            </p>
          </div>
          <button className="secondary" onClick={demo}>
            加载演示数据
          </button>
        </section>
      )}
    </>
  );
}
