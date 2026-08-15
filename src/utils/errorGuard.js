let attached = false

function showError(message, detail) {
  const el = document.getElementById('app')
  if (!el) return
  let box = document.getElementById('fatal-error')
  if (!box) {
    box = document.createElement('div')
    box.id = 'fatal-error'
    box.style.cssText =
      'position:fixed;inset:0;background:#fff;color:#1f2a1f;z-index:9999;' +
      'display:flex;align-items:center;justify-content:center;padding:24px;font-family:sans-serif;'
    box.innerHTML =
      '<div style="max-width:560px"><h2 style="margin:0 0 8px;color:#c0392b">页面加载出错</h2>' +
      '<p id="fatal-msg" style="margin:0 0 8px;font-size:15px"></p>' +
      '<pre id="fatal-detail" style="white-space:pre-wrap;word-break:break-all;background:#f5f7f5;' +
      'padding:12px;border-radius:8px;font-size:12px;max-height:300px;overflow:auto"></pre>' +
      '<button onclick="location.reload()" style="margin-top:12px;padding:8px 18px;border:none;' +
      'background:#2f6b3a;color:#fff;border-radius:8px;cursor:pointer">重新加载</button></div>'
    document.body.appendChild(box)
  }
  document.getElementById('fatal-msg').textContent = message
  document.getElementById('fatal-detail').textContent = detail || ''
}

export function attachErrorGuard() {
  if (attached) return
  attached = true
  window.addEventListener('error', (e) => {
    const msg = e.message || '脚本运行错误'
    const detail = (e.filename || '') + ':' + (e.lineno || '') + '\n' + (e.error && e.error.stack ? e.error.stack : '')
    showError(msg, detail)
  })
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason
    const msg = reason && reason.message ? reason.message : '异步任务出错'
    const detail = reason && reason.stack ? reason.stack : String(reason)
    showError(msg, detail)
  })
}