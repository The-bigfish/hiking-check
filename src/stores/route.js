import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getAll, getByIndex, put, bulkPut, remove, removeByIndex, uid } from '../db/db'

export const useRouteStore = defineStore('route', () => {
  const routes = ref([])
  const routeItems = ref({}) // route_id -> [{ id, gear_id, required, quantity }]
  const loaded = ref(false)

  async function load() {
    routes.value = await getAll('route_templates')
    const allItems = await getAll('route_items')
    routeItems.value = {}
    for (const item of allItems) {
      if (!routeItems.value[item.route_id]) routeItems.value[item.route_id] = []
      routeItems.value[item.route_id].push(item)
    }
    loaded.value = true
  }

  async function addRoute(data) {
    const route = { id: uid(), type: 'day', ...data, createdAt: Date.now() }
    await put('route_templates', route)
    routes.value.push(route)
    routeItems.value[route.id] = []
    return route
  }

  async function updateRoute(id, data) {
    const route = { ...routes.value.find((r) => r.id === id), ...data }
    await put('route_templates', route)
    const idx = routes.value.findIndex((r) => r.id === id)
    if (idx > -1) routes.value[idx] = route
    return route
  }

  async function removeRoute(id) {
    await remove('route_templates', id)
    await removeByIndex('route_items', 'route_id', id)
    routes.value = routes.value.filter((r) => r.id !== id)
    delete routeItems.value[id]
  }

  async function saveRouteItems(routeId, items) {
    // items: [{ gear_id, required, quantity }]
    await removeByIndex('route_items', 'route_id', routeId)
    const records = items.map((it) => ({ id: uid(), route_id: routeId, ...it }))
    await bulkPut('route_items', records)
    routeItems.value[routeId] = records
  }

  function itemsOf(routeId) {
    return routeItems.value[routeId] || []
  }

  return { routes, routeItems, loaded, load, addRoute, updateRoute, removeRoute, saveRouteItems, itemsOf }
})
