import { useState } from "react";
import Dexie from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { VersionData } from "./VersionData";
import { CategoryManager } from "./Categories";
import { TemplateEditor } from "./Templates";
import { uid, type Template } from "./model";
import { db } from "./db";
import {
  exportAndRecord,
  restoreBackup,
  validateBackup,
  download,
} from "./backup";
import { Heading, Editor, txt } from "./ui";
import type { useOffline } from "./Offline";
export function Settings({
  offline,
  run,
  demo,
}: {
  offline: ReturnType<typeof useOffline>;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  demo: () => void;
}) {
  const [persistent, setPersistent] = useState("尚未检查"),
    [restoring, setRestoring] = useState(false),
    [edit, setEdit] = useState<Template>(),
    [categoriesOpen, setCategoriesOpen] = useState(false);
  const templates = useLiveQuery(() => db.templates.toArray()) || [];
  return (
    <>
      <Heading
        eyebrow="YOUR DATA. YOUR TRAILS."
        title="我的与数据"
        description="数据属于你，保存在当前设备。记得为山野记忆留一份备份。"
      />
      <VersionData offline={offline} />
      <button className="secondary" onClick={() => setCategoriesOpen(true)}>
        管理分类
      </button>
      {categoriesOpen && (
        <CategoryManager onClose={() => setCategoriesOpen(false)} />
      )}
      <div className="two-col">
        <section className="panel">
          <h2>出发前 · 离线检查</h2>
          <div className="settings-row">
            <span>当前网络</span>
            <strong>{offline.online ? "在线" : "离线"}</strong>
          </div>
          <div className="settings-row">
            <span>离线资源</span>
            <strong>{offline.ready ? "已就绪" : "未确认就绪"}</strong>
          </div>
          <p className="muted">{offline.detail}</p>
          <button onClick={() => offline.check()}>检查离线使用条件</button>
          <hr />
          <h3>安装到手机主屏幕</h3>
          <p>
            Android：浏览器菜单 → 安装应用。
            <br />
            iPhone：Safari 分享 → 添加到主屏幕。
          </p>
          <p className="muted">
            首次需联网访问 HTTPS
            站点并等待缓存完成。开发模式不提供离线缓存；请使用生产构建。离线地图、轨迹、天气服务与云同步不包含在此版本中。
          </p>
        </section>
        <section className="panel">
          <h2>本机存储与备份</h2>
          <p className="muted">
            IndexedDB
            保存所有业务数据与照片。没有账号，也没有云端备份。清理浏览器数据或系统回收可能导致数据丢失。
          </p>
          <div className="settings-row">
            <span>持久存储</span>
            <strong>{persistent}</strong>
          </div>
          <button
            className="secondary"
            onClick={() =>
              run(async () => {
                if (!navigator.storage?.persist)
                  throw Error("浏览器不支持申请持久存储，请定期导出备份");
                const ok = await Dexie.waitFor(navigator.storage.persist());
                const estimate = await Dexie.waitFor(
                  navigator.storage.estimate(),
                );
                setPersistent(
                  `${ok ? "已获准" : "未获准，请定期备份"} · 已用 ${((estimate.usage || 0) / 1024 / 1024).toFixed(1)} MB`,
                );
              })
            }
          >
            申请持久存储
          </button>
          <hr />
          <div className="toolbar">
            <button onClick={() => run(() => exportAndRecord())}>
              导出完整备份
            </button>
            <label className="file-button secondary">
              {restoring ? "恢复中…" : "选择备份恢复"}
              <input
                type="file"
                accept="application/json,.json"
                disabled={restoring}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  await run(async () => {
                    if (f.size > 200 * 1024 * 1024)
                      throw Error("备份超过 200 MB，当前恢复器不支持");
                    const input = JSON.parse(await Dexie.waitFor(f.text()));
                    const data = validateBackup(input);
                    if (
                      !confirm(
                        `已校验：${data.gear.length} 件装备、${data.trips.length} 个行程、${data.attachments.length} 张照片。\n恢复采用完整覆盖，不合并。建议先导出当前备份。确认覆盖本机全部数据？`,
                      )
                    )
                      return;
                    setRestoring(true);
                    try {
                      await restoreBackup(input);
                    } finally {
                      setRestoring(false);
                    }
                  });
                }}
              />
            </label>
          </div>
          <p className="hint">
            备份含格式版本号、关联记录及本地照片。恢复先校验，再通过事务整体覆盖；校验或写入失败不会清空旧数据。
          </p>
        </section>
      </div>
      <section className="panel">
        <div className="section-head">
          <h2>装备模板</h2>
          <button
            onClick={() =>
              setEdit({ id: uid(), name: "新模板", notes: "", items: [] })
            }
          >
            新建模板
          </button>
          <span className="muted">在行程打包页保存常用组合</span>
        </div>
        {templates.map((t) => (
          <div className="list-row" key={t.id}>
            <div className="grow">
              <h3>{t.name}</h3>
              <p className="muted">{t.items.length} 个条目</p>
            </div>
            <button className="text-btn" onClick={() => setEdit(t)}>
              详情与编辑
            </button>
            <button
              className="text-btn danger"
              onClick={() => {
                if (confirm("删除此模板？已添加到行程的条目不受影响。"))
                  void run(() => db.templates.delete(t.id));
              }}
            >
              删除
            </button>
          </div>
        ))}
        {!templates.length && (
          <p className="muted">
            从行程中保存「单日轻装」「两天露营」等自己的常用组合。
          </p>
        )}
      </section>
      <section className="panel">
        <h2>开始探索</h2>
        <p className="muted">
          空白数据库可加载一套中文演示数据。不会覆盖已有记录。
        </p>
        <button className="secondary" onClick={demo}>
          加载演示数据
        </button>
      </section>
      {edit && (
        <TemplateEditor template={edit} onClose={() => setEdit(undefined)} />
      )}
    </>
  );
}
