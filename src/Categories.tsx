import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { uid, type Category, type CategorySystem } from "./model";
import {
  saveCategory,
  deleteCategory,
  moveCategory,
  categoryReferences,
} from "./categoryService";
import { iconNames } from "./migration";
import { BuiltinIcon } from "./GearImage";
import { Modal } from "./Modal";
export function CategoryManager({
  onClose,
  initialSystem = "gear",
}: {
  onClose: () => void;
  initialSystem?: CategorySystem;
}) {
  const [system, setSystem] = useState(initialSystem),
    [draft, setDraft] = useState<Category>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [remove, setRemove] = useState<Category>(),
    [target, setTarget] = useState("");
  const all =
    useLiveQuery(() => db.categories.orderBy("order").toArray()) || [];
  async function run(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="分类管理" onClose={onClose} dirty={!!draft}>
      <div className="tabs">
        {(["gear", "expense"] as const).map((s) => (
          <button
            type="button"
            key={s}
            disabled={!!draft}
            className={s === system ? "active" : ""}
            onClick={() => setSystem(s)}
          >
            {s === "gear" ? "装备 / 待购" : "费用"}
          </button>
        ))}
      </div>
      <p className="hint">
        停用后历史仍可查看。删除被引用分类需先迁移，完成行程的分类快照不会改名。
      </p>
      <button
        type="button"
        onClick={() =>
          setDraft({
            id: uid(),
            system,
            name: "",
            icon: "其他",
            order: all.filter((c) => c.system === system).length,
            disabled: false,
          })
        }
      >
        新增分类
      </button>
      {all
        .filter((c) => c.system === system)
        .map((c) => (
          <div className="category-row" key={c.id}>
            <BuiltinIcon name={c.icon} />
            <strong className="grow">
              {c.name}
              {c.disabled && "（已停用）"}
            </strong>
            <button
              type="button"
              className="text-btn"
              aria-label={`上移${c.name}`}
              onClick={() => run(() => moveCategory(c.id, -1))}
            >
              ↑
            </button>
            <button
              type="button"
              className="text-btn"
              aria-label={`下移${c.name}`}
              onClick={() => run(() => moveCategory(c.id, 1))}
            >
              ↓
            </button>
            <button
              type="button"
              className="text-btn"
              onClick={() => setDraft({ ...c })}
            >
              编辑
            </button>
            <button
              type="button"
              className="text-btn"
              onClick={() =>
                run(() => saveCategory({ ...c, disabled: !c.disabled }))
              }
            >
              {c.disabled ? "启用" : "停用"}
            </button>
            <button
              type="button"
              className="text-btn danger"
              onClick={() =>
                run(async () => {
                  if (await categoryReferences(c.id)) {
                    setRemove(c);
                    setTarget("");
                  } else if (confirm(`删除未引用分类“${c.name}”？`))
                    await deleteCategory(c.id);
                })
              }
            >
              删除
            </button>
          </div>
        ))}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {draft && (
        <div className="category-edit">
          <label>
            分类名称
            <input
              aria-label="分类名称"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label>
            内置图标
            <select
              aria-label="内置图标"
              value={draft.icon}
              onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
            >
              {iconNames.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <div className="toolbar">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await saveCategory(draft);
                  setDraft(undefined);
                })
              }
            >
              保存分类
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setDraft(undefined)}
            >
              取消编辑
            </button>
          </div>
        </div>
      )}
      {remove && (
        <div className="notice">
          <p>“{remove.name}”已被引用，请迁移到：</p>
          <select
            aria-label="迁移目标分类"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">请选择</option>
            {all
              .filter(
                (c) =>
                  c.system === remove.system &&
                  c.id !== remove.id &&
                  !c.disabled,
              )
              .map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <button
            type="button"
            disabled={busy || !target}
            onClick={() =>
              run(async () => {
                if (
                  !confirm("迁移关联后删除此分类？已完成行程保留原分类文字。")
                )
                  return;
                await deleteCategory(remove.id, target);
                setRemove(undefined);
              })
            }
          >
            迁移并删除
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => setRemove(undefined)}
          >
            取消
          </button>
        </div>
      )}
    </Modal>
  );
}
export function CategorySelect({
  system = "gear",
  name = "category",
  initialId,
  initialName,
  label = "分类",
  allowInactive = false,
  inputId,
}: {
  system?: CategorySystem;
  name?: string;
  initialId?: string;
  initialName?: string;
  label?: string;
  allowInactive?: boolean;
  inputId?: string;
}) {
  const all =
    useLiveQuery(
      () => db.categories.where("system").equals(system).sortBy("order"),
      [system],
    ) || [];
  const [selected, setSelected] = useState<string | undefined>(),
    [search, setSearch] = useState(""),
    [manage, setManage] = useState(false);
  const original =
    all.find((c) => c.id === initialId) ||
    all.find((c) => c.name === initialName?.trim());
  const value =
    selected ??
    (original && (!original.disabled || allowInactive)
      ? original.id
      : undefined) ??
    all.find((c) => !c.disabled)?.id ??
    "";
  const options = all.filter(
    (c) =>
      (!c.disabled || (allowInactive && c.id === original?.id)) &&
      (c.name.includes(search) || c.id === value),
  );
  return (
    <>
      <input
        aria-label={`搜索${label}`}
        placeholder="搜索分类…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <select
        id={inputId}
        name={name}
        aria-label={label}
        value={value}
        required
        onChange={(e) => setSelected(e.target.value)}
      >
        {!value && <option value="">请选择分类</option>}
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.disabled ? "（已停用）" : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="text-btn"
        onClick={() => setManage(true)}
      >
        管理分类
      </button>
      {manage && (
        <CategoryManager
          initialSystem={system}
          onClose={() => setManage(false)}
        />
      )}
    </>
  );
}
