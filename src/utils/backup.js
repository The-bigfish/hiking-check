import { getAll, clear, bulkPut, storeNames } from '../db/db'

export async function exportData() {
  const payload = { app: 'hiking-gear-checklist', version: 1, exportedAt: new Date().toISOString() }
  for (const name of storeNames()) {
    payload[name] = await getAll(name)
  }
  return JSON.stringify(payload, null, 2)
}

export function downloadJSON(filename, content) {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function importData(json) {
  let payload
  try {
    payload = JSON.parse(json)
  } catch {
    throw new Error('文件不是有效的 JSON')
  }
  if (!payload || payload.app !== 'hiking-gear-checklist' || typeof payload !== 'object') {
    throw new Error('不是本应用的备份文件')
  }
  for (const name of storeNames()) {
    await clear(name)
    if (Array.isArray(payload[name])) {
      await bulkPut(name, payload[name])
    }
  }
}
