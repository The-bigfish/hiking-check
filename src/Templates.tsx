import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { uid, type Template, type Item } from "./model";
import { Modal } from "./Modal";
import { Editor, txt, num, select, type Field } from "./ui";
import { GearPicker } from "./GearPicker";
import { GearImage } from "./GearImage";
import { snapshot } from "./services";
import { saveTemplate, templatePreview, applyTemplate } from "./packingService";
export const itemFields: Field[] = [
  txt("name", "物品名称", true),
  { key: "category", label: "分类", categorySystem: "gear", required: true },
  num("quantity", "本人实际携带数量", 1, 0.1),
  num("weight", "单件重量（克）"),
  num("price", "单价（元）", 0, 0.01),
  { key: "required", label: "必带物品", type: "checkbox", value: true },
  select("carry", "携带方式", ["背包内", "穿戴", "公共装备"]),
  select("kind", "重量类别", ["非消耗品", "消耗品", "饮水"]),
  { key: "notes", label: "备注", type: "textarea" },
];
export function TemplateEditor({
  template,
  onClose,
}: {
  template: Template;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Template>(() => structuredClone(template)),
    [dirty, setDirty] = useState(false),
    [picker, setPicker] = useState(false),
    [entry, setEntry] = useState<number | null | undefined>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  function change(next: Template) {
    setDraft(next);
    setDirty(true);
  }
  return (
    <Modal title="模板详情与编辑" onClose={onClose} dirty={dirty}>
      <label>
        模板名称
        <input
          aria-label="模板名称"
          value={draft.name}
          onChange={(e) => change({ ...draft, name: e.target.value })}
        />
      </label>
      <label>
        模板备注
        <textarea
          aria-label="模板备注"
          value={draft.notes || ""}
          onChange={(e) => change({ ...draft, notes: e.target.value })}
        />
      </label>
      <div className="toolbar">
        <button onClick={() => setPicker(true)}>新增库中装备</button>
        <button className="secondary" onClick={() => setEntry(null)}>
          新增临时物品
        </button>
      </div>
      <p className="hint">编辑此模板不会修改已经套用的行程。</p>
      {draft.items.map((i, index) => (
        <div className="list-row" key={i.sourceId || index}>
          <GearImage {...i} />
          <div className="grow">
            <h3>{i.name}</h3>
            <small>
              {i.category} · × {i.quantity} · {i.required ? "必带" : "选带"} ·{" "}
              {i.carry}
            </small>
          </div>
          <button className="text-btn" onClick={() => setEntry(index)}>
            编辑条目
          </button>
          <button
            className="text-btn danger"
            onClick={() =>
              change({
                ...draft,
                items: draft.items.filter((_, n) => n !== index),
              })
            }
          >
            移除
          </button>
        </div>
      ))}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-footer">
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await saveTemplate(draft);
              onClose();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          保存模板
        </button>
      </div>
      {picker && (
        <GearPicker
          existingIds={draft.items.flatMap((i) => (i.gearId ? [i.gearId] : []))}
          onClose={() => setPicker(false)}
          onAdd={async (ids) => {
            const gs = await db.gear.bulkGet(ids);
            const next = gs
              .filter((g) => !!g)
              .map((g) => {
                const { id, tripId, ...i } = snapshot(g, "");
                return { ...i, sourceId: uid() };
              });
            change({ ...draft, items: [...draft.items, ...next] });
          }}
        />
      )}
      {entry !== undefined && (
        <Editor
          title="编辑模板条目"
          fields={itemFields}
          initial={
            entry !== null
              ? { ...draft.items[entry], price: draft.items[entry].price / 100 }
              : undefined
          }
          onClose={() => setEntry(undefined)}
          onSave={async (v) => {
            if (v.quantity <= 0) throw Error("数量须大于 0");
            const items = [...draft.items];
            const previous = entry === null ? undefined : items[entry];
            const i = {
              ...previous,
              ...v,
              price: Math.round(v.price * 100),
              sourceId: previous?.sourceId || uid(),
              state: "待准备",
            };
            if (entry === null) items.push(i);
            else items[entry] = i;
            change({ ...draft, items });
          }}
        />
      )}
    </Modal>
  );
}
export function TemplateApply({
  tripId,
  onClose,
}: {
  tripId: string;
  onClose: () => void;
}) {
  const templates = useLiveQuery(() => db.templates.toArray()) || [],
    items =
      useLiveQuery(
        () => db.items.where("tripId").equals(tripId).toArray(),
        [tripId],
      ) || [];
  const [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const t = templates.find((t) => t.id === (selected || templates[0]?.id));
  const preview = t ? templatePreview(t, items) : undefined;
  return (
    <Modal title="使用装备模板" onClose={onClose}>
      <select
        aria-label="选择模板"
        value={t?.id || ""}
        onChange={(e) => {
          setSelected(e.target.value);
          setMessage("");
        }}
      >
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {preview && (
        <>
          <p className="notice">
            模板共 {preview.total} 项，行程已有 {preview.existing}{" "}
            项，本次只加入缺少的 {preview.missing.length} 项。
          </p>
          {preview.missing.map((i, n) => (
            <div className="list-row" key={n}>
              <GearImage {...i} />
              <span>
                {i.name} · × {i.quantity}
              </span>
            </div>
          ))}
          {!preview.missing.length && <p role="status">清单已包含全部装备</p>}
        </>
      )}
      {!t && <p>尚无模板，请先保存或创建一个模板。</p>}
      {message && <p role="status">{message}</p>}
      <div className="form-footer">
        <button
          disabled={busy || !preview?.missing.length}
          onClick={async () => {
            if (!t || busy) return;
            setBusy(true);
            try {
              const count = await applyTemplate(tripId, t.id);
              setMessage(count ? `已加入 ${count} 项` : "清单已包含全部装备");
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          确认加入缺少装备
        </button>
      </div>
    </Modal>
  );
}
