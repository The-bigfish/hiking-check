import { useEffect, useRef, useState, useId, type ReactNode } from "react";
import { X, Plus, Mountain, ArrowUpRight } from "lucide-react";
import Dexie from "dexie";
import { CategorySelect } from "./Categories";
import { db } from "./db";
import { business } from "./changes";
import type { CategorySystem } from "./model";
export type Field = {
  key: string;
  label: string;
  type?: string;
  options?: string[];
  required?: boolean;
  min?: number;
  step?: number;
  hint?: string;
  value?: unknown;
  categorySystem?: CategorySystem;
};
export function Editor({
  title,
  fields,
  initial,
  onSave,
  onClose,
}: {
  title: string;
  fields: Field[];
  initial?: Record<string, any>;
  onSave: (v: any) => Promise<unknown>;
  onClose: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const modalRef = useRef<HTMLElement>(null);
  const formId = useId();
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modalRef.current
      ?.querySelector<HTMLElement>("input, select, textarea")
      ?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={modalRef}
        data-editor-dirty={dirty ? "true" : undefined}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const controls = [
            ...e.currentTarget.querySelectorAll<HTMLElement>(
              "button:not(:disabled), input, select, textarea",
            ),
          ];
          const first = controls[0],
            last = controls.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="section-head">
          <h2>{title}</h2>
          <button
            className="icon-btn"
            aria-label="关闭"
            disabled={busy}
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        <form
          onChange={() => setDirty(true)}
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            window.dispatchEvent(new Event("shanxing:saving"));
            const form = new FormData(e.currentTarget);
            const values: Record<string, any> = {};
            try {
              for (const f of fields) {
                const raw = form.get(f.key);
                if (f.categorySystem) {
                  const c = await db.categories.get(String(raw));
                  if (!c || c.system !== f.categorySystem)
                    throw Error("请选择有效分类");
                  if (
                    c.disabled &&
                    c.id !== initial?.categoryId &&
                    c.name !== initial?.category
                  )
                    throw Error("此分类已停用，请选择其他分类");
                  values.categoryId = c.id;
                  values[f.key] = c.name;
                  continue;
                }
                values[f.key] =
                  f.type === "checkbox"
                    ? raw === "on"
                    : f.type === "number"
                      ? raw === ""
                        ? null
                        : Number(raw)
                      : f.type === "file"
                        ? raw
                        : String(raw ?? "").trim();
                if (
                  f.type === "number" &&
                  values[f.key] !== null &&
                  (!Number.isFinite(values[f.key]) ||
                    Math.abs(values[f.key]) > 1e6 ||
                    values[f.key] < (f.min ?? 0))
                )
                  throw Error(`${f.label}超出允许范围`);
                if (
                  f.required &&
                  (values[f.key] === null || values[f.key] === "")
                )
                  throw Error(`请填写${f.label}`);
              }
              await business(() => onSave(values));
              window.dispatchEvent(new Event("shanxing:saved"));
              onClose();
            } catch (err) {
              window.dispatchEvent(new Event("shanxing:save-failed"));
              setError(
                err instanceof Error
                  ? err.message
                  : "保存失败，请重试或导出备份。",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            {fields.map((f) => (
              <div
                className={
                  f.type === "textarea" ? "form-field span-2" : "form-field"
                }
                key={f.key}
              >
                <label htmlFor={`${formId}-${f.key}`}>
                  {f.label}
                  {f.required && " *"}
                </label>
                {f.categorySystem ? (
                  <CategorySelect
                    inputId={`${formId}-${f.key}`}
                    allowInactive={!!initial}
                    system={f.categorySystem}
                    name={f.key}
                    initialId={initial?.categoryId}
                    initialName={initial?.[f.key] ?? String(f.value || "其他")}
                    label={f.label}
                  />
                ) : f.options ? (
                  <select
                    id={`${formId}-${f.key}`}
                    aria-label={f.label}
                    name={f.key}
                    defaultValue={initial?.[f.key] ?? f.value ?? f.options[0]}
                  >
                    {f.options.map((o) => (
                      <option key={o} value={o}>
                        {o.replace(/ · [0-9a-f-]{36}$/i, "")}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    id={`${formId}-${f.key}`}
                    name={f.key}
                    defaultValue={initial?.[f.key] ?? f.value ?? ""}
                    rows={3}
                  />
                ) : (
                  <input
                    id={`${formId}-${f.key}`}
                    name={f.key}
                    type={f.type || "text"}
                    defaultValue={
                      f.type === "file" || f.type === "checkbox"
                        ? undefined
                        : (initial?.[f.key] ?? f.value ?? "")
                    }
                    defaultChecked={
                      f.type === "checkbox"
                        ? !!(initial?.[f.key] ?? f.value)
                        : undefined
                    }
                    required={f.required}
                    min={f.min ?? (f.type === "number" ? 0 : undefined)}
                    step={f.step ?? (f.type === "number" ? 1 : undefined)}
                    max={f.type === "number" ? 1e6 : undefined}
                    accept={
                      f.type === "file"
                        ? "image/jpeg,image/png,image/webp,image/gif"
                        : undefined
                    }
                  />
                )}{" "}
                {f.hint && <small>{f.hint}</small>}
              </div>
            ))}
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="form-footer">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={onClose}
            >
              取消
            </button>
            <button disabled={busy} type="submit">
              {busy ? "正在保存…" : "保存"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
export function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Mountain size={38} />
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action}
    </header>
  );
}
export function Add({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick}>
      <Plus size={18} />
      {children}
    </button>
  );
}
export function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
export function LinkButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-btn" onClick={onClick}>
      {children}
      <ArrowUpRight size={16} />
    </button>
  );
}
export async function photo(file: File | undefined) {
  if (!file?.size) return undefined;
  if (file.size > 5 * 1024 * 1024) throw Error("照片最大 5 MB，请先压缩图片");
  if (
    !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)
  )
    throw Error("请选择 JPG、PNG、WebP 或 GIF 图片");
  return Dexie.waitFor(
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(Error("照片读取失败"));
      reader.readAsDataURL(file);
    }),
  );
}
export const num = (
  key: string,
  label: string,
  value = 0,
  step = 1,
): Field => ({ key, label, type: "number", required: true, value, step });
export const txt = (key: string, label: string, required = false): Field => ({
  key,
  label,
  required,
});
export const select = (
  key: string,
  label: string,
  options: string[],
): Field => ({ key, label, options });
