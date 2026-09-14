import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ShoppingBag, ExternalLink } from "lucide-react";
import { GearImage } from "./GearImage";

// Internal trip item IDs remain stored for reliable deduplication, but are never shown to users.
function displayReason(reason: string) {
  return reason.replace(/^(复盘替换：.+?)\s*\/\s*[0-9a-f]{8}-[0-9a-f-]{27,}$/i, "$1");
}
import { db } from "./db";
import { uid, money, today, type Wish } from "./model";
import { purchase, undoPurchase } from "./services";
import { gearFields } from "./Gear";
import { Heading, Add, Stat, Empty, Editor, txt, num, select } from "./ui";
export function Wishes({
  run,
}: {
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const wishes = useLiveQuery(() => db.wishes.toArray()) || [],
    gear =
      useLiveQuery(() => db.gear.filter((g) => !g.archived).toArray()) || [],
    items =
      useLiveQuery(() => db.items.filter((i) => !i.gearId).toArray()) || [],
    trips = useLiveQuery(() => db.trips.toArray()) || [];
  const [edit, setEdit] = useState<Wish | null | undefined>(),
    [buy, setBuy] = useState<Wish>(),
    [filter, setFilter] = useState("待购买");
  return (
    <>
      <Heading
        eyebrow="MAKE ROOM FOR THE RIGHT GEAR"
        title="待购清单"
        description="有计划地添置，把预算留给真正需要的装备。"
        action={<Add onClick={() => setEdit(null)}>添加待购</Add>}
      />
      <div className="stats">
        <Stat
          label="待购预算"
          value={money(
            wishes
              .filter((w) => w.status === "待购买")
              .reduce((a, w) => a + w.price, 0),
          )}
        />
        <Stat
          label="待购买"
          value={`${wishes.filter((w) => w.status === "待购买").length} 件`}
        />
        <Stat
          label="已购入"
          value={`${wishes.filter((w) => w.status === "已购买").length} 件`}
        />
      </div>
      <div className="tabs">
        {["待购买", "已购买", "已放弃"].map((s) => (
          <button
            className={filter === s ? "active" : ""}
            key={s}
            onClick={() => setFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="panel">
        {wishes
          .filter((w) => w.status === filter)
          .map((w) => (
            <article className="list-row" key={w.id}>
              <div className="round-icon">
                <GearImage {...w} />
              </div>
              <div className="grow">
                <h3>
                  {w.name} <span className="badge">{w.priority}</span>
                </h3>
                <p className="muted">
                  {w.category} · {w.brand} {w.model} · {w.weight} g
                </p>
                <p>{displayReason(w.reason)}</p>
                {/^https?:\/\//i.test(w.url) && (
                  <a href={w.url} target="_blank" rel="noopener noreferrer">
                    购买参考 <ExternalLink size={13} />
                  </a>
                )}
              </div>
              <div className="align-right">
                <strong>{money(w.price)}</strong>
                <div className="row-actions">
                  {w.status === "待购买" ? (
                    <>
                      <button onClick={() => setBuy(w)}>标记已购买</button>
                      <button className="text-btn" onClick={() => setEdit(w)}>
                        编辑
                      </button>
                      <button
                        className="text-btn"
                        onClick={() =>
                          run(() =>
                            db.wishes.update(w.id, { status: "已放弃" }),
                          )
                        }
                      >
                        放弃
                      </button>
                    </>
                  ) : w.status === "已购买" ? (
                    <button
                      className="secondary"
                      onClick={() => {
                        if (
                          confirm(
                            "撤销购买并处理生成的装备？如已被其他行程引用，将阻止撤销。",
                          )
                        )
                          void run(() => undoPurchase(w.id));
                      }}
                    >
                      撤销购买
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        run(() => db.wishes.update(w.id, { status: "待购买" }))
                      }
                    >
                      恢复待购
                    </button>
                  )}
                  {w.status !== "已购买" && (
                    <button
                      className="text-btn danger"
                      onClick={() => {
                        if (confirm("永久删除这个待购条目？"))
                          void run(() => db.wishes.delete(w.id));
                      }}
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        {!wishes.some((w) => w.status === filter) && (
          <Empty
            title="这里还没有条目"
            detail="从一件能改善体验的装备开始，理性添置。"
          />
        )}
      </div>
      {edit !== undefined && (
        <Editor
          title={edit ? "编辑待购" : "添加待购"}
          fields={[
            txt("name", "名称", true),
            {
              key: "category",
              label: "分类",
              categorySystem: "gear",
              required: true,
            },
            txt("brand", "品牌"),
            txt("model", "型号"),
            num("price", "预计价格（元）", 0, 0.01),
            num("weight", "预计重量（克）"),
            { key: "url", label: "购买链接", type: "url" },
            select("priority", "优先级", ["普通", "优先", "可等"]),
            { key: "reason", label: "购买原因", type: "textarea" },
            select("linked", "替换行程临时装备", [
              "不关联",
              ...items
                .filter(
                  (i) =>
                    trips.find((t) => t.id === i.tripId)?.status !== "已完成",
                )
                .map((i) => `${i.name} · ${i.id}`),
            ]),
          ]}
          initial={
            edit
              ? {
                  ...edit,
                  price: edit.price / 100,
                  linked: edit.tripItemId
                    ? `${items.find((i) => i.id === edit.tripItemId)?.name} · ${edit.tripItemId}`
                    : "不关联",
                }
              : undefined
          }
          onClose={() => setEdit(undefined)}
          onSave={async (v) => {
            if (v.url && !/^https?:\/\//i.test(v.url))
              throw Error("购买链接仅支持 http 或 https");
            const { linked, ...rest } = v;
            await db.wishes.put({
              ...rest,
              id: edit?.id || uid(),
              status: "待购买",
              price: Math.round(v.price * 100),
              tripItemId:
                linked === "不关联" ? undefined : linked.split(" · ").at(-1),
            });
          }}
        />
      )}
      {buy && (
        <Editor
          title="确认实际购买并入库"
          initial={{
            ...buy,
            price: buy.price / 100,
            quantity: 1,
            date: today(),
            status: "正常",
          }}
          fields={[
            ...gearFields.filter((f) => f.key !== "photo"),
            select("existing", "入库方式", [
              "创建新装备",
              ...gear.map((g) => `${g.name} · ${g.id}`),
            ]),
          ]}
          onClose={() => setBuy(undefined)}
          onSave={async (v) => {
            if (v.quantity < 1) throw Error("购入数量至少为 1");
            const { existing, ...rest } = v;
            await purchase(
              buy.id,
              { ...rest, id: uid(), price: Math.round(v.price * 100) },
              existing === "创建新装备"
                ? undefined
                : existing.split(" · ").at(-1),
            );
          }}
        />
      )}
    </>
  );
}
