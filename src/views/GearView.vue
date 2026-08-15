<script setup>
import { ref, computed } from 'vue'
import { useGearStore } from '../stores/gear'
import { CATEGORIES, categoryLabel } from '../utils/constants'
import GearForm from '../components/GearForm.vue'

const gearStore = useGearStore()

const search = ref('')
const filterCat = ref('')
const showForm = ref(false)
const editing = ref(null)

const filtered = computed(() => {
  const kw = search.value.trim().toLowerCase()
  return gearStore.items.filter((it) => {
    if (filterCat.value && it.category !== filterCat.value) return false
    if (!kw) return true
    return (
      it.name.toLowerCase().includes(kw) ||
      (it.note || '').toLowerCase().includes(kw)
    )
  })
})

const grouped = computed(() => {
  const map = {}
  for (const cat of CATEGORIES) map[cat.key] = []
  for (const it of filtered.value) {
    if (!map[it.category]) map[it.category] = []
    map[it.category].push(it)
  }
  return CATEGORIES.map((c) => ({ ...c, items: map[c.key] })).filter((g) => g.items.length)
})

function openAdd() {
  editing.value = null
  showForm.value = true
}

function openEdit(item) {
  editing.value = item
  showForm.value = true
}

async function onSubmit(data) {
  if (editing.value) {
    await gearStore.update(editing.value.id, data)
  } else {
    await gearStore.add(data)
  }
  showForm.value = false
}

async function onDelete(item) {
  if (confirm(`确定删除装备「${item.name}」吗？`)) {
    await gearStore.removeItem(item.id)
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <h1>装备库</h1>
      <button class="btn btn-primary" @click="openAdd">+ 新增装备</button>
    </div>

    <div class="toolbar card">
      <input v-model="search" class="toolbar-search" placeholder="搜索装备名称或备注" />
      <select v-model="filterCat" class="toolbar-cat">
        <option value="">全部分类</option>
        <option v-for="c in CATEGORIES" :key="c.key" :value="c.key">{{ c.label }}</option>
      </select>
      <span class="toolbar-count">{{ filtered.length }} 件</span>
    </div>

    <div v-if="!filtered.length" class="card empty">
      <p>还没有装备，点击「新增装备」开始维护清单</p>
    </div>

    <section v-for="g in grouped" :key="g.key" class="cat-group">
      <h2 class="cat-title">{{ g.label }} <span>{{ g.items.length }}</span></h2>
      <div class="gear-list">
        <div v-for="it in g.items" :key="it.id" class="card gear-item" :class="{ 'gear-item-warn': !it.name }">
          <div class="gear-info">
            <div class="gear-name">
              {{ it.name }}
              <span v-if="it.quantity > 1" class="gear-qty">x{{ it.quantity }}</span>
            </div>
            <div class="gear-meta">
              <span v-if="it.weight">约 {{ it.weight }}g</span>
              <span v-if="it.note">{{ it.note }}</span>
            </div>
          </div>
          <div class="gear-actions">
            <button class="btn btn-ghost btn-sm" @click="openEdit(it)">编辑</button>
            <button class="btn btn-danger btn-sm" @click="onDelete(it)">删除</button>
          </div>
        </div>
      </div>
    </section>

    <GearForm
      v-model="showForm"
      :initial="editing"
      @submit="onSubmit"
    />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.toolbar-search {
  flex: 1;
  min-width: 180px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  outline: none;
}
.toolbar-search:focus {
  border-color: var(--primary);
}
.toolbar-cat {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.toolbar-count {
  font-size: 13px;
  color: var(--text-muted);
  white-space: nowrap;
}

.cat-group {
  margin-bottom: 18px;
}
.cat-title {
  font-size: 15px;
  margin: 0 0 8px;
  color: var(--text-muted);
}
.cat-title span {
  margin-left: 4px;
  font-weight: 400;
}

.gear-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}
.gear-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
}
.gear-name {
  font-size: 15px;
  font-weight: 600;
}
.gear-qty {
  color: var(--text-muted);
  font-weight: 400;
  font-size: 13px;
}
.gear-meta {
  margin-top: 3px;
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.gear-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

@media (max-width: 480px) {
  .gear-list {
    grid-template-columns: 1fr;
  }
}
</style>