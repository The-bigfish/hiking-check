<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRecordStore } from '../stores/record'
import { categoryLabel, routeTypeLabel } from '../utils/constants'
import Modal from '../components/Modal.vue'

const router = useRouter()
const recordStore = useRecordStore()

const detail = ref(null)

function openDetail(record) {
  detail.value = record
}

function closeDetail() {
  detail.value = null
}

async function onDelete(record) {
  if (confirm(`确定删除 ${record.date} 的检查记录吗？`)) {
    await recordStore.removeRecord(record.id)
    if (detail.value?.id === record.id) detail.value = null
  }
}

function again(record) {
  router.push({ path: '/check', query: { route_id: record.route_id } })
}

function editRecord(record) {
  router.push({ path: '/check', query: { edit_record: record.id } })
}

function rateClass(record) {
  if (record.complete) return 'ok'
  if (record.required_missing) return 'warn'
  return 'bad'
}

function rateText(record) {
  if (record.complete) return '已齐'
  if (record.required_missing) return '缺必带'
  return '未全勾'
}
</script>

<template>
  <div>
    <div class="page-head">
      <h1>历史记录</h1>
    </div>

    <div v-if="!recordStore.records.length" class="card empty">
      <p>还没有检查记录，去「出发检查」完成一次检查吧</p>
    </div>

    <div v-else class="record-list">
      <div v-for="r in recordStore.records" :key="r.id" class="card record-item">
        <button class="record-main" @click="openDetail(r)">
          <div class="record-date">{{ r.date }}</div>
          <div class="record-name">
            {{ r.route_name }}
            <span class="tag">{{ routeTypeLabel(r.route_type) }}</span>
          </div>
        </button>
        <div class="record-right">
          <span class="rate" :class="rateClass(r)">{{ rateText(r) }} · {{ r.checked }}/{{ r.total }}</span>
          <div class="record-actions">
            <button class="btn btn-ghost btn-sm" @click="editRecord(r)">继续编辑</button>
            <button class="btn btn-ghost btn-sm" @click="again(r)">再次检查</button>
            <button class="btn btn-danger btn-sm" @click="onDelete(r)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <Modal v-if="detail" title="检查详情" @close="closeDetail">
      <div class="detail-meta">
        <div>{{ detail.date }} · {{ detail.route_name }}（{{ routeTypeLabel(detail.route_type) }}）</div>
        <div class="rate" :class="rateClass(detail)">{{ rateText(detail) }}，勾选 {{ detail.checked }}/{{ detail.total }}</div>
      </div>
      <div class="detail-list">
        <div v-for="(it, i) in detail.items" :key="i" class="detail-row" :class="{ undone: !it.checked, req: it.required }">
          <span class="dot">{{ it.checked ? '√' : '·' }}</span>
          <span class="d-name">{{ it.name }}<template v-if="it.quantity > 1"> x{{ it.quantity }}</template></span>
          <span class="d-cat">{{ categoryLabel(it.category) }}</span>
          <span v-if="it.required" class="req-mark">必带</span>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.record-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 10px;
}
.record-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
}
.record-main {
  border: none;
  background: none;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
  min-width: 0;
}
.record-date {
  font-size: 12px;
  color: var(--text-muted);
}
.record-name {
  font-size: 15px;
  font-weight: 600;
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.record-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}
.record-actions {
  display: flex;
  gap: 6px;
}
.rate {
  font-size: 12px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 99px;
}
.rate.ok {
  background: var(--primary-soft);
  color: var(--ok);
}
.rate.warn {
  background: var(--warn-soft);
  color: var(--warn);
}
.rate.bad {
  background: var(--danger-soft);
  color: var(--danger);
}

.detail-meta {
  font-size: 14px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.detail-meta .rate {
  align-self: flex-start;
}
.detail-list {
  max-height: 60vh;
  overflow-y: auto;
}
.detail-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}
.detail-row.req {
  background: var(--warn-soft);
  border-radius: 6px;
  padding: 8px 6px;
}
.dot {
  width: 18px;
  text-align: center;
  font-weight: 700;
}
.detail-row.undone .dot {
  color: var(--text-muted);
}
.detail-row:not(.undone) .dot {
  color: var(--ok);
}
.d-name {
  flex: 1;
  min-width: 0;
}
.detail-row.undone .d-name {
  color: var(--text-muted);
  text-decoration: line-through;
}
.d-cat {
  font-size: 12px;
  color: var(--text-muted);
}
.req-mark {
  font-size: 10px;
  color: var(--warn);
  border: 1px solid var(--warn);
  border-radius: 99px;
  padding: 0 6px;
}

@media (max-width: 480px) {
  .record-list {
    grid-template-columns: 1fr;
  }
  .record-item {
    flex-wrap: wrap;
  }
  .record-right {
    align-items: flex-start;
    width: 100%;
    flex-direction: row;
    justify-content: space-between;
  }
}
</style>