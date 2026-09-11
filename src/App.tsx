import { Component, useEffect, useState, type ReactNode } from "react";
import {
  Mountain,
  House,
  Backpack,
  Route,
  ShoppingBag,
  UserRound,
  Wifi,
  WifiOff,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Home } from "./Home";
import { GearPage } from "./Gear";
import { Wishes } from "./Wishes";
import { Trips } from "./Trips";
import { Settings } from "./Settings";
import { useOffline } from "./Offline";
import { seedDemo } from "./demo";
import { business } from "./changes";
import { BackupReminder } from "./VersionData";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <div className="panel fatal">
        <h1>暂时无法读取应用数据</h1>
        <p role="alert">{this.state.error}</p>
        <p>
          请确认浏览器允许本地存储，勿清理浏览器数据。重新打开后可在「我的」导出备份。
        </p>
        <button onClick={() => location.reload()}>重新加载</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const [page, setPage] = useState("首页"),
    [selected, setSelected] = useState(""),
    [save, setSave] = useState("本机数据已加载"),
    [error, setError] = useState("");
  const offline = useOffline();
  useEffect(() => {
    const saved = () =>
      setSave(
        `已保存到本机 · ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`,
      );
    window.addEventListener("shanxing:saved", saved);
    const saving = () => setSave("正在保存到本机…");
    const failed = () => setSave("保存失败 · 请检查表单提示");
    window.addEventListener("shanxing:saving", saving);
    window.addEventListener("shanxing:save-failed", failed);
    return () => {
      window.removeEventListener("shanxing:saved", saved);
      window.removeEventListener("shanxing:saving", saving);
      window.removeEventListener("shanxing:save-failed", failed);
    };
  }, []);
  async function run(fn: () => Promise<unknown>) {
    setError("");
    setSave("正在保存 / 处理…");
    try {
      await business(fn);
      setSave(
        `本机操作成功 · ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`,
      );
    } catch (e) {
      setSave("操作未完成");
      setError(
        e instanceof Error ? e.message : "本机保存失败，请重试并及时导出备份。",
      );
    }
  }
  const go = (s: string) => {
      setPage(s);
      window.scrollTo(0, 0);
    },
    demo = () => {
      if (confirm("向空白数据库加载中文演示数据？")) void run(seedDemo);
    },
    nav = [
      { name: "首页", icon: House },
      { name: "装备", icon: Backpack },
      { name: "行程", icon: Route },
      { name: "待购", icon: ShoppingBag },
      { name: "我的", icon: UserRound },
    ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("首页");
          }}
        >
          <span>
            <Mountain size={27} />
          </span>
          <div>
            山行清单<small>TRAIL COMPANION</small>
          </div>
        </a>
        <p className="nav-caption">我的山野手册</p>
        <nav>
          {nav.map(({ name, icon: Icon }) => (
            <button
              className={page === name ? "nav-item active" : "nav-item"}
              key={name}
              onClick={() => go(name)}
            >
              <Icon size={21} />
              <span>{name}</span>
              {page === name && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Mountain size={38} strokeWidth={1} />
          <p>轻装有备，自在山行。</p>
          <small>每一步，都算数。</small>
        </div>
        <div className="local-mark">
          <ShieldCheck size={16} />
          本机优先 · 无需账号
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <Mountain size={24} />
            山行清单
          </div>
          <span className="breadcrumb">
            我的山野手册 <span>/</span> {page}
          </span>
          <div className="system-status">
            <span>
              {offline.online ? <Wifi size={14} /> : <WifiOff size={14} />}
              <b>{offline.online ? "在线" : "离线"}</b>
            </span>
            <button className="status-link" onClick={() => go("我的")}>
              <ShieldCheck size={14} />
              {offline.ready ? "离线资源就绪" : "离线资源待检查"}
            </button>
            <span className="save-state" role="status">
              <CheckCircle2 size={14} />
              {save}
            </span>
          </div>
        </header>
        <main>
          <BackupReminder />
          {offline.update && (
            <div className="notice">
              <span>发现新版本，已保存的数据会保留。</span>
              <button onClick={offline.applyUpdate}>
                发现新版本，更新并重启
              </button>
            </div>
          )}
          {error && (
            <div role="alert" className="error global-error">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button onClick={() => setError("")} className="text-btn">
                关闭
              </button>
            </div>
          )}
          {page === "首页" ? (
            <Home
              go={go}
              openTrip={(id) => {
                setSelected(id);
                go("行程");
              }}
              demo={demo}
            />
          ) : page === "装备" ? (
            <GearPage run={run} />
          ) : page === "待购" ? (
            <Wishes run={run} />
          ) : page === "行程" ? (
            <Trips selected={selected} onSelect={setSelected} run={run} />
          ) : (
            <Settings offline={offline} run={run} demo={demo} />
          )}
          <footer>
            山行清单 <span>·</span> 让每一次出发更从容 <span>·</span>{" "}
            数据仅保存在当前设备
          </footer>
        </main>
      </div>
      <nav className="bottom-nav">
        {nav.map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={page === name ? "active" : ""}
            onClick={() => go(name)}
          >
            <Icon size={21} />
            <span>{name}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
