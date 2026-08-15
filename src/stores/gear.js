import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getAll, put, remove, uid } from '../db/db.js'

export const useGearStore = defineStore('gear', () => {
  const items = ref([])
  const loaded = ref(false)

  async function load() {
    items.value = await getAll('gear_items')
    items.value.sort((a, b) => (a.category || '').localeCompare(b.category || ''))
    loaded.value = true
  }

  async function add(data) {
    const item = { id: uid(), ...data, createdAt: Date.now() }
    await put('gear_items', item)
    items.value.push(item)
    return item
  }

  async function update(id, data) {
    const item = { ...items.value.find((i) => i.id === id), ...data }
    await put('gear_items', item)
    const idx = items.value.findIndex((i) => i.id === id)
    if (idx > -1) items.value[idx] = item
    return item
  }

  async function removeItem(id) {
    await remove('gear_items', id)
    items.value = items.value.filter((i) => i.id !== id)
  }

  function byId(id) {
    return items.value.find((i) => i.id === id)
  }

  return { items, loaded, load, add, update, removeItem, byId }
})
