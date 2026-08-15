<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useGearStore } from '../stores/gear'
import { useRouteStore } from '../stores/route'
import { useRecordStore } from '../stores/record'
import { categoryLabel, formatDate, ROUTE_TYPES, routeTypeLabel } from '../utils/constants'
import { uid } from '../db/db'
import { applyRecordStateToChecks, buildItemsSnapshot } from '../utils/checkHelpers'

const route = useRoute()
const gearStore = useGearStore()
const routeStore = useRouteStore()
const recordStore = useRecordStore()

const typeFilter = ref('all')
const selectedRouteId = ref(null)
const checks = ref([])
const startDate = ref(formatDate(new Date()))
const savedMsg = ref('')
const editingRecordId = ref(null)

const filteredRoutes = computed(() => {
  if (typeFilter.value === 'all') return routeStore.routes
  return routeStore.routes.filter((r) => r.type === typeFilter.value)
})

const selectedRoute = computed(() => routeStore.routes.find((r) => r.id === selectedRouteId.value) || null)

watch(
  [() => route.query, () => routeStore.loaded, () => recordStore.loaded],
  () => {
    if (!routeStore.loaded || !recordStore.loaded) return
    const recId = route.query.edit_record
    const rid = route.query.route_id
    if (recId) {
      const rec = recordStore.records.find((r) => r.id === recId)
      if (!rec) return
      editingRecordId.value = rec.id
      selectedRouteId.value = rec.route_id
      startDate.value = rec.date || formatDate(new Date())
      savedMsg.value = ''
      buildChecks(rec.route_id)
      applyRecordStateToChecks(checks.value, rec.items)
    } else if (rid && rid !== selectedRouteId.value) {
      editingRecordId.value = null
      const target = routeStore.routes.find((r) => r.id === rid)
      if (target) startCheck(target.id)
    } else {
      editingRecordId.value = null
      selectedRouteId.value = null
      checks.value = []
      savedMsg.value = ''
    }
  },
  { immediate: true },
)

function buildChecks(routeId) {
  const items = routeStore.itemsOf(routeId)
  checks.value = items.map((it) => {
    const gear = gearStore.byId(it.gear_id)
    return {
      id: uid(),
      gear_id: it.gear_id,
      name: gear ? gear.name : '（已从装备库删除）',
      category: gear ? gear.category : 'other',
      required: !!it.required,
      quantity: it.quantity || 1,
      checked: false,
      stale: !gear,
    }
  })
}

function startCheck(routeId) {
  editingRecordId.value = null
  selectedRouteId.value = routeId
  savedMsg.value = ''
  buildChecks(routeId)
}

function restart() {
  buildChecks(selectedRouteId.value)
  savedMsg.value = ''
}

const total = computed(() => checks.value.length)
const checkedCount = computed(() => checks.value.filter((c) => c.checked).length)
const missingRequired = computed(() => checks.value.filter((c) => c.required && !c.checked))
const progress = computed(() => (total.value ? Math.round((checkedCount.value / total.value) * 100) : 0))
const allDone = computed(() => total.value > 0 && missingRequired.value.length === 0)
const isComplete = computed(() => total.value > 0 && checkedCount.value === total.value)

function goBack() {
  editingRecordId.value = null
  selectedRouteId.value = null
  checks.value = []
  savedMsg.value = ''
}

async function saveRecord() {
  const itemsSnapshot = buildItemsSnapshot(checks.value)
  const payload = {
    date: startDate.value,
    route_id: selectedRoute.value.id,
    route_name: selectedRoute.value.name,
    route_type: selectedRoute.value.type,
    total: total.value,
    checked: checkedCount.value,
    required_missing: missingRequired.value.length,
    complete: isComplete.value,
    items: itemsSnapshot,
  }
  if (editingRecordId.value) {
    await recordStore.updateRecord(editingRecordId.value, payload)
    savedMsg.value = '已更新记录'
  } else {
    await recordStore.saveRecord(payload)
    savedMsg.value = '已保存到历史记录'
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <h1>出发检查</h1>
    </div>

    <!-- 阶段 1：选择路线 -->
    <template v-if="!selectedRoute">
      <div class="tabs card" v-if="routeStore.routes.length">
        <button class="tab" :class="{ active: typeFilter === 'all' }" @click="typeFilter = 'all'">全部</button>
        <button v-for="t in ROUTE_TYPES" :key="t.key" class="tab" :class="{ active: typeFilter === t.key }" @click="typeFilter = t.key">
          {{ t.label }}
        </button>
      </div>

      <div v-if="!filteredRoutes.length" class="card empty">
        <p>还没有路线模板，请先到「路线模板」页面创建</p>
        <RouterLink to="/routes"><button class="btn btn-primary">去创建路线</button></RouterLink>
      </div>

      <div class="route-select">
        <button v-for="r in filteredRoutes" :key="r.id" class="card route-select-item" @click="startCheck(r.id)">
          <div>
            <div class="route-name">{{ r.name }}</div>
            <div class="route-tags">
              <span class="tag">{{ routeTypeLabel(r.type) }}</span>
              <span class="tag">{{ routeStore.itemsOf(r.id).filter((i) => i.required).length }} 项必带</span>
            </div>
          </div>
          <span class="route-go">开始 →</span>
        </button>
      </div>
    </template>

    <!-- 阶段 2：清单勾选 -->
    <template v-else>
      <div class="check-head card">
        <div class="check-head-info">
          <button class="back" @click="goBack">← 返回</button>
          <div>
            <div class="check-route-name">
              {{ selectedRoute.name }}
              <span v-if="editingRecordId" class="editing-badge">继续编辑 {{ startDate }} 的记录</span>
            </div>
            <div class="check-route-meta">
              {{ routeTypeLabel(selectedRoute.type) }} · {{ total }} 项装备
              <span v-if="missingRequired.length" class="missing-warn">缺 {{ missingRequired.length }} 项必带装备</span>
            </div>
          </div>
        </div>
        <div class="progress-block">
          <div class="progress-bar"><div class="progress-fill" :style="{ width: progress + '%' }" :class="{ ok: isComplete }"></div></div>
          <div class="progress-text">{{ checkedCount }}/{{ total }}</div>
          <div v-if="isComplete" class="progress-badge">全部完成</div>
        </div>
      </div>

      <div v-if="missingRequired.length && !isComplete" class="warn-card">
        <div class="warn-title">出发前必带的装备还没有勾选：</div>
        <div class="warn-items">
          <span v-for="m in missingRequired" :key="m.id" class="tag tag-warn">{{ m.name }}<template v-if="m.quantity > 1"> x{{ m.quantity }}</template></span>
        </div>
      </div>

      <div class="check-list">
        <div v-for="c in checks" :key="c.id" class="card check-item" :class="{ done: c.checked }">
          <label class="check-main">
            <input type="checkbox" v-model="c.checked" @change="savedMsg = ''" />
            <span class="check-content">
              <span class="check-name">
                {{ c.name }}
                <template v-if="c.quantity > 1">x{{ c.quantity }}</template>
                <span v-if="c.stale" class="stale">已删除</span>
              </span>
              <span class="check-cat">{{ categoryLabel(c.category) }}</span>
            </span>
          </label>
          <span v-if="c.required" class="req-badge">必带</span>
        </div>
      </div>

      <div class="check-actions">
        <button class="btn btn-ghost" @click="restart">重置</button>
        <button class="btn" :class="allDone ? 'btn-primary' : 'btn-ghost'" @click="saveRecord">
          {{ isComplete ? '完成并保存记录' : '保存记录' }}
        </button>
      </div>
      <div v-if="savedMsg" class="saved-msg card">
        <span>√ {{ savedMsg }}</span>
        <RouterLink to="/records">查看历史记录 →</RouterLink>
      </div>
    </template>
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

.route-select {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}
.route-select-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 16px;
  text-align: left;
  font-family: inherit;
  width: 100%;
}
.route-select-item:hover {
  border-color: var(--primary);
}
.route-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}
.route-tags {
  display: flex;
  gap: 6px;
}
.route-go {
  color: var(--primary);
  font-size: 14px;
  flex-shrink: 0;
}

.check-head {
  padding: 14px 16px;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.check-head-info {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.back {
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 14px;
  padding: 2px 4px;
}
.check-route-name {
  font-size: 17px;
  font-weight: 600;
}
.editing-badge {
  display: inline-block;
  margin-left: 8px;
  font-size: 11px;
  font-weight: 400;
  color: var(--primary);
  background: var(--primary-soft);
  border-radius: 99px;
  padding: 1px 8px;
  vertical-align: middle;
}
.check-route-meta {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}
.missing-warn {
  color: var(--danger);
}
.progress-block {
  display: flex;
  align-items: center;
  gap: 10px;
}
.progress-bar {
  width: 140px;
  height: 8px;
  background: var(--border);
  border-radius: 99px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--primary);
  transition: width 0.2s;
}
.progress-fill.ok {
  background: var(--ok);
}
.progress-text {
  font-size: 14px;
  font-weight: 600;
}
.progress-badge {
  font-size: 12px;
  padding: 2px 8px;
  background: var(--primary-soft);
  color: var(--ok);
  border-radius: 99px;
}

.warn-card {
  background: var(--warn-soft);
  border: 1px solid #eed59a;
  border-radius: var(--radius);
  padding: 12px 16px;
  margin-bottom: 12px;
}
.warn-title {
  font-size: 14px;
  color: var(--warn);
  font-weight: 600;
  margin-bottom: 8px;
}
.warn-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.check-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 10px;
}
.check-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
}
.check-item.done {
  background: var(--primary-soft);
  border-color: var(--primary);
}
.check-main {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  cursor: pointer;
}
.check-main input {
  width: 20px;
  height: 20px;
  accent-color: var(--primary);
  flex-shrink: 0;
}
.check-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.check-name {
  font-size: 15px;
}
.check-item.done .check-name {
  color: var(--text-muted);
  text-decoration: line-through;
}
.stale {
  font-size: 11px;
  color: var(--danger);
  background: var(--danger-soft);
  padding: 1px 6px;
  border-radius: 99px;
  margin-left: 6px;
}
.check-cat {
  font-size: 12px;
  color: var(--text-muted);
}
.req-badge {
  font-size: 11px;
  color: var(--danger);
  border: 1px solid var(--danger);
  padding: 1px 8px;
  border-radius: 99px;
  flex-shrink: 0;
}

.check-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
  position: sticky;
  bottom: 76px;
}
.saved-msg {
  margin-top: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 14px;
  color: var(--ok);
}
.saved-msg a {
  color: var(--primary);
  font-size: 14px;
}

@media (max-width: 768px) {
  .check-actions {
    bottom: calc(var(--nav-h) + 12px);
  }
  .progress-bar {
    width: 100px;
  }
}

@media (max-width: 480px) {
  .check-list {
    grid-template-columns: 1fr;
  }
  .route-select {
    grid-template-columns: 1fr;
  }
}
</style>