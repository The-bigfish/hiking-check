import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import type { Gear } from "./model";
import { GearImage } from "./GearImage";
import { Modal } from "./Modal";
export function GearPicker({
  existingIds,
  onAdd,
  onClose,
}: {
  existingIds: string[];
  onAdd: (ids: string[]) => Promise<unknown>;
  onClose: () => void;
}) {
  const gear =
    useLiveQuery(() =>
      db.gear.filter((g) => !g.archived && g.status === "正常").toArray(),
    ) || [];
  const categories =
    useLiveQuery(() =>
      db.categories.where("system").equals("gear").sortBy("order"),
    ) || [];
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const shown = gear.filter(
    (g) =>
      (!category || g.categoryId === category) &&
      [g.name, g.brand, g.model, g.tags]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const available = shown.filter((g) => !existingIds.includes(g.id));
  const effective = selected.filter((id) => !existingIds.includes(id));
  return (
    <Modal title="从装备库批量添加" onClose={onClose}>
      <div className="toolbar">
        <input
          aria-label="搜索可选装备"
          placeholder="搜索装备、品牌或标签"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="选择器分类筛选"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">全部分类</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.disabled ? "（已停用）" : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="secondary"
          onClick={() =>
            setSelected([
              ...new Set([...selected, ...available.map((g) => g.id)]),
            ])
          }
        >
          全选当前筛选结果
        </button>
        <button
          type="button"
          className="text-btn"
          onClick={() => setSelected([])}
        >
          清空选择
        </button>
      </div>
      <p className="muted">
        已添加装备不可重复选择；需要增加数量请编辑已有条目。
      </p>
      {shown.map((g) => (
        <label className="gear-choice" key={g.id}>
          <input
            type="checkbox"
            aria-label={`选择装备 ${g.name}`}
            disabled={existingIds.includes(g.id) || busy}
            checked={effective.includes(g.id)}
            onChange={(e) =>
              setSelected(
                e.target.checked
                  ? [...selected, g.id]
                  : selected.filter((id) => id !== g.id),
              )
            }
          />
          <GearImage {...g} />
          <span className="grow">
            <strong>{g.name}</strong>
            <small>
              {g.category} · {g.weight} g{g.brand && ` · ${g.brand}`}
            </small>
          </span>
          {existingIds.includes(g.id) && <span className="badge">已添加</span>}
        </label>
      ))}
      {!shown.length && <p className="empty">没有匹配装备</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-footer">
        <strong>已选 {effective.length} 件</strong>
        <button
          disabled={busy || !effective.length}
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            setError("");
            try {
              await onAdd(effective);
              onClose();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "添加中…" : "添加所选"}
        </button>
      </div>
    </Modal>
  );
}
