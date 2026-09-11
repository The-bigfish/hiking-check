import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { buildInfo } from "./version";
export function useOffline() {
  const [online, setOnline] = useState(navigator.onLine),
    [checked, setChecked] = useState(false),
    [detail, setDetail] = useState("尚未检查离线资源"),
    [checking, setChecking] = useState(false),
    [updateResult, setUpdateResult] = useState("尚未检查更新");
  const {
    offlineReady: [ready],
    needRefresh: [update, setUpdate],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(e) {
      setDetail(`离线资源注册失败：${e.message}`);
    },
  });
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    const migrated = () =>
      setUpdateResult("其他窗口已升级数据库，请保存手头内容后重新打开本页。");
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    window.addEventListener("shanxing:database-upgraded", migrated);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      window.removeEventListener("shanxing:database-upgraded", migrated);
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
        "页面、脚本、样式和内置图标已缓存。出发前请用飞行模式重开验证。",
      );
    } catch (e) {
      setChecked(false);
      setDetail((e as Error).message);
    }
  }
  async function checkUpdate() {
    if (checking) return;
    if (!navigator.onLine) {
      setUpdateResult("当前离线，暂时无法检查更新。");
      return;
    }
    setChecking(true);
    setUpdateResult("正在联网检查…");
    try {
      const response = await fetch(`/build-info.json?check=${Date.now()}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw Error("版本服务不可用");
      const remote = await response.json();
      if (
        typeof remote.buildId !== "string" ||
        typeof remote.version !== "string"
      )
        throw Error("版本信息无效");
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) throw Error("离线服务尚未注册，请使用生产版本");
      await reg.update();
      if (reg.installing)
        await new Promise<void>((resolve, reject) => {
          const worker = reg.installing!;
          const timer = setTimeout(() => {
            worker.removeEventListener("statechange", change);
            reject(Error("新资源下载超时，请稍后重试"));
          }, 20000);
          function change() {
            if (worker.state === "installed" || worker.state === "activated") {
              clearTimeout(timer);
              worker.removeEventListener("statechange", change);
              resolve();
            } else if (worker.state === "redundant") {
              clearTimeout(timer);
              worker.removeEventListener("statechange", change);
              reject(Error("新资源安装失败"));
            }
          }
          worker.addEventListener("statechange", change);
          change();
        });
      if (reg.waiting) {
        setUpdate(true);
        setUpdateResult("发现新版本，资源已下载，等待你选择更新。");
      } else if (remote.buildId !== buildInfo.buildId)
        setUpdateResult(
          "检测到不同构建，资源仍在准备中。请稍后检查，当前页面尚未更新。",
        );
      else setUpdateResult(`检查完成：当前已是最新版本 ${buildInfo.version}。`);
    } catch (e) {
      setUpdateResult(
        `检查未完成：${navigator.onLine ? (e as Error).message : "当前离线，暂时无法检查更新"}`,
      );
    } finally {
      setChecking(false);
    }
  }
  async function applyUpdate() {
    if (document.querySelector('[data-editor-dirty="true"]')) {
      setUpdateResult("有未保存编辑，请先保存或取消编辑，再更新。");
      alert("有未保存编辑，请先保存或取消编辑，再更新。");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg?.waiting) {
        setUpdateResult("新版本尚未准备就绪，请先检查更新。");
        return;
      }
      setUpdateResult("正在更新并重启…");
      await updateServiceWorker(true);
    } catch (e) {
      setUpdateResult(`更新失败，已保存的数据保留：${(e as Error).message}`);
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
    applyUpdate,
    checking,
    checkUpdate,
    updateResult,
  };
}
