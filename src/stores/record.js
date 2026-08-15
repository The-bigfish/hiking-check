import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getAll, put, remove, uid } from '../db/db.js'

export const useRecordStore = defineStore('record', () => {
  const records = ref([])
  const loaded = ref(false)

  async function load() {
    records.value = await getAll('check_records')
    records.value.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    loaded.value = true
  }

  async function saveRecord(data) {
    const record = { id: uid(), ...data, createdAt: Date.now() }
    await put('check_records', record)
    records.value.unshift(record)
    return record
  }

  async function removeRecord(id) {
    await remove('check_records', id)
    records.value = records.value.filter((r) => r.id !== id)
  }

  async function updateRecord(id, data) {
    const idx = records.value.findIndex((r) => r.id === id)
    const old = records.value[idx] || {}
    const record = { ...old, ...data, id, createdAt: old.createdAt ?? Date.now() }
    await put('check_records', record)
    if (idx > -1) {
      records.value[idx] = record
    } else {
      records.value.unshift(record)
    }
    return record
  }

  return { records, loaded, load, saveRecord, updateRecord, removeRecord }
})