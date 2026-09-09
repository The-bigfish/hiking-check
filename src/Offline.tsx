import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
export function useOffline() {
  const [online, setOnline] = useState(navigator.onLine),
    [checked, setChecked] = useState(false),
    [detail, setDetail] = useState("尚未检查离线资源");
  const {
    offlineReady: [ready],
    needRefresh: [update],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(e) {
      setDetail(`离线资源注册失败：${e.message}`);
    },
  });
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  async function check() {
    try {
      if (!("serviceWorker" in navigator) || !("caches" in window))
        throw Error("此环境不支持离线缓存，请使用 HTTPS 或 localhost");
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg?.active) throw Error("离线资源尚未安装完成，请联网等待后再检查");
      const names = (await caches.keys()).filter((n) =>
        n.includes("workbox-precache"),
      );
      if (!names.length) throw Error("未找到应用离线资源");
      let index = false,
        js = false,
        css = false,
        icons = 0;
      for (const name of names) {
        const cache = await caches.open(name);
        for (const req of await cache.keys()) {
          const response = await cache.match(req);
          if (!response?.ok) throw Error("资源缓存不完整");
          const path = new URL(req.url).pathname;
          if (path.endsWith("index.html")) index = true;
          if (path.endsWith(".js")) js = true;
          if (path.endsWith(".css")) css = true;
          if (path.includes("icon-")) icons++;
        }
      }
      if (!index || !js || !css || icons < 2)
        throw Error("关键离线资源尚未完整缓存");
      setChecked(true);
      setDetail(
        "核心页面、脚本、样式与图标已缓存。建议出发前再用飞行模式重开验证。",
      );
    } catch (e) {
      setChecked(false);
      setDetail(e instanceof Error ? e.message : "离线检查失败");
    }
  }
  useEffect(() => {
    void check();
  }, [ready]);
  return {
    online,
    ready: checked,
    detail,
    check,
    update,
    applyUpdate: () => updateServiceWorker(true),
  };
}
