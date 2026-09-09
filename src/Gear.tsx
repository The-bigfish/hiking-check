import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Backpack, Copy, Pencil, Archive, Search } from "lucide-react";
import { db } from "./db";
import {
  categories,
  uid,
  today,
  money,
  kg,
  type Gear as GearType,
} from "./model";
import { removeGear } from "./services";
import { csv } from "./backup";
import {
  Heading,
  Add,
  Stat,
  Empty,
  Editor,
  num,
  txt,
  select,
  photo,
  type Field,
} from "./ui";
export const gearFields: Field[] = [
  txt("name", "装备名称", true),
  { key: "category", label: "分类（可自定义）", required: true, value: "其他" },
  txt("brand", "品牌"),
  txt("model", "型号"),
  num("weight", "单件重量（克）"),
  num("quantity", "拥有数量", 1),
  num("price", "单件购置价（元）", 0, 0.01),
  { key: "date", label: "购买日期", type: "date", value: today() },
  select("status", "装备状态", ["正常", "待维修", "已退役", "已遗失"]),
  txt("location", "存放位置"),
  txt("tags", "标签（逗号分隔）"),
  { key: "maintenance", label: "下次保养日期", type: "date" },
  { key: "notes", label: "备注 / 保养说明", type: "textarea" },
  { key: "photo", label: "本地照片（最大 5 MB）", type: "file" },
];
export function GearPage({
  run,
}: {
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const gears = useLiveQuery(() => db.gear.toArray()) || [],
    attachments = useLiveQuery(() => db.attachments.toArray()) || [];
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("全部"),
    [status, setStatus] = useState("全部"),
    [sort, setSort] = useState("名称"),
    [archived, setArchived] = useState(false),
    [edit, setEdit] = useState<GearType | null | undefined>(),
    [selected, setSelected] = useState<string[]>([]);
  const active = gears.filter((g) => !g.archived),
    list = gears
      .filter(
        (g) =>
          !!g.archived === archived &&
          (category === "全部" || g.category === category) &&
          (status === "全部" || g.status === status) &&
          [g.name, g.brand, g.model, g.tags]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase()),
      )
      .sort((a, b) =>
        sort === "重量"
          ? b.weight - a.weight
          : sort === "金额"
            ? b.price - a.price
            : a.name.localeCompare(b.name, "zh"),
      );
  return (
    <>
      <Heading
        eyebrow="YOUR GEAR, WELL ORGANIZED"
        title="装备库"
        description="每一件装备，都为下一次出发做好准备。"
        action={<Add onClick={() => setEdit(null)}>新增装备</Add>}
      />
      <div className="stats">
        <Stat
          label="装备总数"
          value={`${active.reduce((a, g) => a + g.quantity, 0)} 件`}
          detail={`${active.length} 种装备`}
        />
        <Stat
          label="装备总重量"
          value={kg(active.reduce((a, g) => a + g.weight * g.quantity, 0))}
        />
        <Stat
          label="累计购置"
          value={money(active.reduce((a, g) => a + g.price * g.quantity, 0))}
          detail="独立于行程支出"
        />
      </div>
      <section className="panel">
        <div className="toolbar">
          <div className="search">
            <Search size={18} />
            <input
              aria-label="搜索装备"
              placeholder="搜索名称、品牌、标签…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="分类筛选"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {[
              "全部",
              ...new Set([...categories, ...gears.map((g) => g.category)]),
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            aria-label="状态筛选"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {["全部", "正常", "待维修", "已退役", "已遗失"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            aria-label="排序"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            {["名称", "重量", "金额"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="section-head">
          <label className="check">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            查看归档
          </label>
          <button
            className="text-btn"
            onClick={() =>
              csv("装备.csv", [
                ["名称", "分类", "单件重量g", "数量", "单价分", "状态", "标签"],
                ...list.map((g) => [
                  g.name,
                  g.category,
                  g.weight,
                  g.quantity,
                  g.price,
                  g.status,
                  g.tags,
                ]),
              ])
            }
          >
            导出 CSV
          </button>
        </div>
        {selected.length > 0 && (
          <div className="notice">
            已选 {selected.length} 件
            <button
              onClick={() =>
                run(async () => {
                  await db.gear
                    .where("id")
                    .anyOf(selected)
                    .modify({ status: "待维修" });
                  setSelected([]);
                })
              }
            >
              批量待维修
            </button>
            <button
              className="secondary"
              onClick={() => {
                if (confirm("将选中装备全部归档？历史快照不会改变。"))
                  void run(async () => {
                    await db.gear
                      .where("id")
                      .anyOf(selected)
                      .modify({ archived: true });
                    setSelected([]);
                  });
              }}
            >
              批量归档
            </button>
          </div>
        )}
        <div className="gear-grid">
          {list.map((g) => (
            <article className="gear-card" key={g.id}>
              <div className="gear-visual">
                {g.attachmentId ? (
                  <img
                    alt={g.name}
                    src={attachments.find((a) => a.id === g.attachmentId)?.data}
                  />
                ) : (
                  <Backpack size={52} strokeWidth={1} />
                )}
                <label className="select-gear">
                  <input
                    aria-label={`选择${g.name}`}
                    type="checkbox"
                    checked={selected.includes(g.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, g.id]
                          : selected.filter((id) => id !== g.id),
                      )
                    }
                  />
                </label>
                <span className="badge">{g.category}</span>
              </div>
              <div className="gear-info">
                <div className="section-head">
                  <h3>{g.name}</h3>
                  <span
                    className={
                      g.status === "正常" ? "status" : "status warning"
                    }
                  >
                    {g.status}
                  </span>
                </div>
                <p className="muted">
                  {[g.brand, g.model].filter(Boolean).join(" · ") ||
                    "未填写品牌型号"}
                </p>
                <div className="gear-metrics">
                  <strong>
                    {g.weight} <small>g / 件</small>
                  </strong>
                  <span>× {g.quantity}</span>
                  <span>{money(g.price)}</span>
                </div>
                <p className="tags">
                  {g.tags || "暂无标签"}
                  {g.location && ` · ${g.location}`}
                </p>
                {g.maintenance && (
                  <p className={g.maintenance <= today() ? "warning" : "muted"}>
                    保养：{g.maintenance}
                  </p>
                )}
                {g.notes && <p className="muted">{g.notes}</p>}
                <div className="row-actions">
                  <button className="text-btn" onClick={() => setEdit(g)}>
                    <Pencil size={15} />
                    编辑
                  </button>
                  <button
                    className="text-btn"
                    aria-label={`复制${g.name}`}
                    onClick={() =>
                      run(() =>
                        db.gear.add({
                          ...g,
                          id: uid(),
                          name: g.name + " · 副本",
                        }),
                      )
                    }
                  >
                    <Copy size={15} />
                    复制
                  </button>
                  {g.archived ? (
                    <button
                      className="text-btn"
                      onClick={() =>
                        run(() => db.gear.update(g.id, { archived: false }))
                      }
                    >
                      取消归档
                    </button>
                  ) : (
                    <button
                      className="text-btn"
                      onClick={() => {
                        if (confirm("删除此装备？有关联记录时将改为归档。"))
                          void run(() => removeGear(g.id));
                      }}
                    >
                      <Archive size={15} />
                      移除
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
        {!list.length && (
          <Empty
            title="为下一次出发建立装备库"
            detail="先添加背包、鞋子或你最常用的一件装备。"
            action={<Add onClick={() => setEdit(null)}>新增装备</Add>}
          />
        )}
      </section>
      {edit !== undefined && (
        <Editor
          title={edit ? "编辑装备" : "新增装备"}
          fields={gearFields}
          initial={edit ? { ...edit, price: edit.price / 100 } : undefined}
          onClose={() => setEdit(undefined)}
          onSave={async (v) => {
            const data = await photo(v.photo);
            delete v.photo;
            const attachmentId = data ? uid() : edit?.attachmentId;
            await db.transaction("rw", [db.gear, db.attachments], async () => {
              if (data)
                await db.attachments.add({
                  id: attachmentId!,
                  data,
                  name: v.name,
                });
              await db.gear.put({
                ...v,
                id: edit?.id || uid(),
                price: Math.round(v.price * 100),
                attachmentId,
                archived: edit?.archived,
              });
            });
          }}
        />
      )}
    </>
  );
}
