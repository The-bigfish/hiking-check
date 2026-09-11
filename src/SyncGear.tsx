import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { gearDifferences, syncGear, type Difference } from "./packingService";
import { Modal } from "./Modal";
const labels = { name: "名称", category: "分类", weight: "单件重量（克）" };
export function SyncGear({
  tripId,
  onClose,
}: {
  tripId: string;
  onClose: () => void;
}) {
  const data = useLiveQuery(async () => {
    const items = await db.items.where("tripId").equals(tripId).toArray();
    return { ...gearDifferences(items, await db.gear.toArray()), items };
  }, [tripId]);
  const [chosen, setChosen] = useState<Difference[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="查看并同步装备更新" onClose={onClose}>
      <p className="hint">
        只同步勾选的名称、分类、单件重量。价格、数量、携带方式、备注和打包状态保持原样。
      </p>
      {data?.diffs.map((d) => (
        <label key={`${d.itemId}:${d.field}`} className="sync-row">
          <input
            type="checkbox"
            aria-label={`同步 ${labels[d.field]} ${d.before}`}
            checked={chosen.some(
              (c) => c.itemId === d.itemId && c.field === d.field,
            )}
            onChange={(e) =>
              setChosen(
                e.target.checked
                  ? [...chosen, d]
                  : chosen.filter(
                      (c) => !(c.itemId === d.itemId && c.field === d.field),
                    ),
              )
            }
          />
          <span>
            <strong>
              {data.items.find((i) => i.id === d.itemId)?.name} ·{" "}
              {labels[d.field]}
            </strong>
            <span className="sync-values">
              {d.before} → {d.after}
            </span>
          </span>
        </label>
      ))}
      {data?.unavailable.map((i) => (
        <p className="notice" key={i.id}>
          {i.name}：装备已归档或不存在，保留当前行程条目。
        </p>
      ))}
      {data && !data.diffs.length && <p>没有可同步的变更。</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="form-footer">
        <button
          disabled={busy || !chosen.length}
          onClick={async () => {
            setBusy(true);
            try {
              await syncGear(tripId, chosen);
              onClose();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          确认同步 {chosen.length} 项变更
        </button>
      </div>
    </Modal>
  );
}
