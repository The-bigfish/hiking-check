import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import { defaultMeta, setBackupThreshold, snoozeBackup } from "./changes";
import { exportAndRecord } from "./backup";
import { buildInfo } from "./version";
import type { useOffline } from "./Offline";
export function BackupReminder() {
  const meta = useLiveQuery(() => db.meta.get("data"));
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (!meta || meta.changes < meta.threshold || meta.snoozeUntil > Date.now())
    return null;
  return (
    <div className="notice backup-reminder" role="status">
      <span>自上次导出已修改 {meta.changes} 次，建议导出一份备份。</span>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await exportAndRecord();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        立即备份
      </button>
      <button
        className="secondary"
        onClick={() => snoozeBackup().catch((e) => setError(e.message))}
      >
        稍后提醒（明天）
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
export function VersionData({
  offline,
}: {
  offline: ReturnType<typeof useOffline>;
}) {
  const meta = useLiveQuery(() => db.meta.get("data")) || defaultMeta;
  const [threshold, setThreshold] = useState<string>(),
    [error, setError] = useState("");
  return (
    <section className="panel">
      <h2>版本与数据</h2>
      <div className="settings-row">
        <span>当前运行版本</span>
        <strong data-testid="app-version">{buildInfo.version}</strong>
      </div>
      <p className="muted version-build">
        构建标识：{buildInfo.buildId}
        <br />
        构建时间：{buildInfo.builtAt}
      </p>
      <div className="toolbar">
        <button disabled={offline.checking} onClick={offline.checkUpdate}>
          {offline.checking ? "检查中…" : "检查更新"}
        </button>
        {offline.update && (
          <button onClick={offline.applyUpdate}>发现新版本，更新并重启</button>
        )}
      </div>
      <p role="status">{offline.updateResult}</p>
      <p className="muted">
        离线资源：{offline.ready ? "已就绪" : "未确认就绪"}
      </p>
      <hr />
      <div className="settings-row">
        <span>上次导出</span>
        <strong>
          {meta.lastExport
            ? new Date(meta.lastExport).toLocaleString("zh-CN")
            : "尚未导出"}
        </strong>
      </div>
      <div className="settings-row">
        <span>自上次导出以来的有效修改</span>
        <strong data-testid="change-count">{meta.changes} 次</strong>
      </div>
      <p className="hint">
        记录的是生成并发起导出的时间，浏览器不能确认文件是否最终保存。请自行妥善保存文件。
      </p>
      <label>
        备份提醒阈值
        <input
          aria-label="备份提醒阈值"
          type="number"
          min={1}
          max={10000}
          value={threshold ?? meta.threshold}
          onChange={(e) => setThreshold(e.target.value)}
        />
      </label>
      <button
        className="secondary"
        onClick={async () => {
          try {
            await setBackupThreshold(Number(threshold ?? meta.threshold));
            setError("");
            setThreshold(undefined);
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        保存提醒设置
      </button>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
