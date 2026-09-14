import { useEffect, useState } from "react";

type WebkitDocument = Document & {
  webkitFullscreenElement?: Element;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => void | Promise<void>;
};
type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: () => void | Promise<void>;
};

export function DisplayMode() {
  const doc = document as WebkitDocument;
  const root = document.documentElement as WebkitElement;
  const active = () => !!(doc.fullscreenElement || doc.webkitFullscreenElement);
  const standalone = () => matchMedia("(display-mode: standalone)").matches ||
    matchMedia("(display-mode: fullscreen)").matches ||
    !!(navigator as Navigator & { standalone?: boolean }).standalone;
  const supported = !!((typeof root.requestFullscreen === "function" && doc.fullscreenEnabled !== false) ||
    (root.webkitRequestFullscreen && doc.webkitFullscreenEnabled !== false));
  const [full, setFull] = useState(active), [installed, setInstalled] = useState(standalone);
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => {
    const update = () => { setFull(active()); setInstalled(standalone()); setBusy(false); };
    const failed = () => { setBusy(false); setMessage("浏览器未允许全屏，请重试或使用主屏幕方式打开。"); };
    const media = matchMedia("(display-mode: standalone)");
    document.addEventListener("fullscreenchange", update);
    document.addEventListener("webkitfullscreenchange", update);
    document.addEventListener("fullscreenerror", failed);
    document.addEventListener("webkitfullscreenerror", failed);
    media.addEventListener?.("change", update);
    return () => {
      document.removeEventListener("fullscreenchange", update);
      document.removeEventListener("webkitfullscreenchange", update);
      document.removeEventListener("fullscreenerror", failed);
      document.removeEventListener("webkitfullscreenerror", failed);
      media.removeEventListener?.("change", update);
    };
  }, []);
  async function toggle() {
    setBusy(true); setMessage("");
    try {
      // Call directly in the click handler to preserve browser user activation.
      if (active()) {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else await doc.webkitExitFullscreen?.();
      } else if (root.requestFullscreen) await root.requestFullscreen();
      else if (root.webkitRequestFullscreen) await root.webkitRequestFullscreen();
      else throw Error("unsupported");
      setFull(active());
    } catch {
      setMessage("浏览器未允许全屏，请重试或使用主屏幕方式打开。");
    } finally { setBusy(false); }
  }
  return <section className="panel">
    <h2>显示与全屏</h2>
    <p role="status">当前显示：{full ? "网页全屏" : installed ? "主屏幕独立窗口" : "浏览器窗口"}</p>
    {supported || full ? <button disabled={busy} onClick={toggle}>{full ? "退出全屏" : "进入全屏"}</button> :
      <p>当前浏览器不支持网页全屏。可以尝试添加到主屏幕后打开。</p>}
    {message && <p role="alert" className="error">{message}</p>}
    <p className="hint">全屏需要主动点击。切换应用、返回或系统手势可能退出全屏；可回到这里再次进入。系统状态栏是否隐藏由设备决定。</p>
    <h3>从主屏幕打开</h3>
    <p>华为 / 鸿蒙 / 安卓：浏览器菜单 → 安装应用或添加到桌面。部分浏览器只创建快捷方式，仍会显示地址栏。</p>
    <p>iPhone：Safari → 分享 → 添加到主屏幕；如有“作为网页 App 打开”，请开启。</p>
  </section>;
}

