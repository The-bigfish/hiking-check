<script setup>
import { ref, computed } from 'vue'
import { useRouteStore } from '../stores/route'
import { ROUTE_TYPES, routeTypeLabel } from '../utils/constants'
import RouteForm from '../components/RouteForm.vue'

const routeStore = useRouteStore()

const typeTab = ref('all')
const showForm = ref(false)
const editing = ref(null)

const filtered = computed(() => {
  if (typeTab.value === 'all') return routeStore.routes
  return routeStore.routes.filter((r) => r.type === typeTab.value)
})

function openAdd() {
  editing.value = null
  showForm.value = true
}

function openEdit(route) {
  editing.value = route
  showForm.value = true
}

async function onSubmit(data) {
  if (editing.value) {
    await routeStore.updateRoute(editing.value.id, data)
    await routeStore.saveRouteItems(editing.value.id, data.items)
  } else {
    const route = await routeStore.addRoute(data)
    await routeStore.saveRouteItems(route.id, data.items)
  }
  showForm.value = false
}

async function onDelete(route) {
  if (confirm(`确定删除路线「${route.name}」吗？`)) {
    await routeStore.removeRoute(route.id)
  }
}

function countOf(route) {
  return routeStore.itemsOf(route.id).length
}

function requiredCount(route) {
  return routeStore.itemsOf(route.id).filter((i) => i.required).length
}
</script>

<template>
  <div>
    <div class="page-head">
      <h1>路线模板</h1>
      <button class="btn btn-primary" @click="openAdd">+ 新增路线</button>
    </div>

    <div class="tabs card">
      <button class="tab" :class="{ active: typeTab === 'all' }" @click="typeTab = 'all'">全部</button>
      <button v-for="t in ROUTE_TYPES" :key="t.key" class="tab" :class="{ active: typeTab === t.key }" @click="typeTab = t.key">
        {{ t.label }}
      </button>
    </div>

    <div v-if="!filtered.length" class="card empty">
      <p>还没有路线模板，点击「新增路线」创建单日线或多日线</p>
    </div>

    <div class="route-grid">
      <div v-for="r in filtered" :key="r.id" class="card route-card">
        <div class="route-head">
          <div>
            <div class="route-name">{{ r.name }}</div>
            <div class="route-tags">
              <span class="tag"><span :class="{ 'tag-warn': r.type === 'multi' }">{{ routeTypeLabel(r.type) }}</span></span>
              <span class="tag">{{ countOf(r) }} 项装备</span>
            </div>
          </div>
          <div class="route-actions">
            <button class="btn btn-ghost btn-sm" @click="openEdit(r)">编辑</button>
            <button class="btn btn-danger btn-sm" @click="onDelete(r)">删除</button>
          </div>
        </div>
        <div class="route-desc" v-if="r.desc">{{ r.desc }}</div>
        <div class="route-meta">
          必带项 {{ requiredCount(r) }} 项
        </div>
      </div>
    </div>

    <RouteForm v-model="showForm" :initial="editing" :current-items="editing ? routeStore.itemsOf(editing.id) : []" @submit="onSubmit" />
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 4px;
  padding: 6px;
  margin-bottom: 16px;
  overflow-x: auto;
}
.tab {
  border: none;
  background: none;
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-muted);
  white-space: nowrap;
}
.tab.active {
  background: var(--primary);
  color: #fff;
}

.route-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}
.route-card {
  padding: 16px;
}
.route-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}
.route-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}
.route-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.route-desc {
  margin-top: 10px;
  font-size: 13px;
  color: var(--text-muted);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.route-meta {
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-muted);
  border-top: 1px dashed var(--border);
  padding-top: 8px;
}

@media (max-width: 480px) {
  .route-grid {
    grid-template-columns: 1fr;
  }
}
</style>