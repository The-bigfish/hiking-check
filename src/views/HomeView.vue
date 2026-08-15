<script setup>
import { computed, ref } from 'vue'
import { useGearStore } from '../stores/gear'
import { useRouteStore } from '../stores/route'
import { useRecordStore } from '../stores/record'
import { formatDate, routeTypeLabel } from '../utils/constants'
import { exportData, downloadJSON, importData } from '../utils/backup'

const gearStore = useGearStore()
const routeStore = useRouteStore()
const recordStore = useRecordStore()

const backupMsg = ref('')
const fileInput = ref(null)

async function onExport() {
  const data = await exportData()
  downloadJSON(`hiking-backup-${formatDate(new Date())}.json`, data)
  backupMsg.value = '已导出备份文件'
}

function onPickFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async (ev) => {
    try {
      await importData(ev.target.result)
      await Promise.all([gearStore.load(), routeStore.load(), recordStore.load()])
      backupMsg.value = '已导入备份数据'
    } catch (err) {
      backupMsg.value = '导入失败：' + err.message
    } finally {
      e.target.value = ''
    }
  }
  reader.readAsText(file)
}

const lastRecord = computed(() => recordStore.records[0] || null)
const hasData = computed(() => gearStore.items.length > 0 || routeStore.routes.length > 0)
const nextSteps = computed(() => {
  const steps = []
  if (!gearStore.items.length) steps.push('去「装备库」添加你的装备')
  else if (!routeStore.routes.length) steps.push('去「路线模板」创建单日线或多日线')
  else steps.push('在「出发检查」中选择路线，完成出发前检查')
  return steps
})
</script>

<template>
  <div>
    <div class="page-head">
      <h1>徒步装备检查</h1>
    </div>

    <div v-if="!hasData" class="card setup">
      <h3>欢迎使用！三步开始：</h3>
      <ol>
        <li>添加你的徒步装备</li>
        <li>创建单日线 / 多日线模板并配置必带装备</li>
        <li>出发前在此检查清单是否齐全</li>
      </ol>
      <div class="setup-actions">
        <RouterLink to="/gear"><button class="btn btn-primary">去添加装备</button></RouterLink>
      </div>
    </div>

    <div v-else class="home-grid">
      <div class="card stat-card">
        <div class="stat-num">{{ gearStore.items.length }}</div>
        <div class="stat-label">装备件数</div>
      </div>
      <div class="card stat-card">
        <div class="stat-num">{{ routeStore.routes.length }}</div>
        <div class="stat-label">路线模板</div>
      </div>
      <div class="card stat-card">
        <div class="stat-num">{{ recordStore.records.length }}</div>
        <div class="stat-label">检查记录</div>
      </div>
    </div>

    <div v-if="lastRecord" class="card last-record">
      <div class="last-head">
        <h3>最近一次检查</h3>
        <RouterLink to="/records">全部记录 →</RouterLink>
      </div>
      <div class="last-body">
        <div class="last-info">
          <div class="last-date">{{ lastRecord.date }}</div>
          <div class="last-name">{{ lastRecord.route_name }} <span class="tag">{{ routeTypeLabel(lastRecord.route_type) }}</span></div>
        </div>
        <div class="last-right">
          <div class="last-rate">{{ lastRecord.checked }}/{{ lastRecord.total }}</div>
          <span class="rate-badge" :class="lastRecord.complete ? 'ok' : 'warn'">{{ lastRecord.complete ? '已齐全' : '有缺项' }}</span>
        </div>
      </div>
      <div v-if="nextSteps.length" class="last-tip">{{ nextSteps[0] }}</div>
    </div>
    <div v-else-if="hasData" class="card empty">
      <p>{{ nextSteps[0] }}</p>
    </div>

    <div v-if="routeStore.routes.length" class="home-cta">
      <RouterLink to="/check"><button class="btn btn-primary btn-lg">开始出发检查</button></RouterLink>
    </div>

    <div class="card backup">
      <div class="backup-title">数据备份</div>
      <p class="backup-tip">数据保存在本机浏览器中（IndexedDB）。建议定期导出备份，换设备或换浏览器时可导入恢复。</p>
      <div class="backup-actions">
        <button class="btn btn-ghost" @click="onExport">导出备份（JSON）</button>
        <button class="btn btn-ghost" @click="fileInput?.click()">导入备份</button>
        <input ref="fileInput" type="file" accept="application/json,.json" style="display: none" @change="onPickFile" />
      </div>
      <div v-if="backupMsg" class="backup-msg">{{ backupMsg }}</div>
    </div>
  </div>
</template>

<style scoped>
.setup {
  padding: 36px;
  max-width: 560px;
  margin: 0 auto;
}
.setup h3 {
  margin: 0 0 16px;
}
.setup ol {
  padding-left: 20px;
  color: var(--text-muted);
  line-height: 1.9;
}
.setup-actions {
  margin-top: 16px;
}

.home-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}
.stat-card {
  padding: 22px;
  text-align: center;
}
.stat-num {
  font-size: 30px;
  font-weight: 700;
  color: var(--primary);
}
.stat-label {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}

.last-record {
  padding: 16px 18px;
  margin-bottom: 14px;
}
.last-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.last-head h3 {
  margin: 0;
  font-size: 15px;
}
.last-head a {
  font-size: 13px;
  color: var(--primary);
  text-decoration: none;
}
.last-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.last-date {
  font-size: 12px;
  color: var(--text-muted);
}
.last-name {
  font-size: 16px;
  font-weight: 600;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.last-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.last-rate {
  font-size: 22px;
  font-weight: 700;
}
.rate-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 99px;
}
.rate-badge.ok {
  background: var(--primary-soft);
  color: var(--ok);
}
.rate-badge.warn {
  background: var(--warn-soft);
  color: var(--warn);
}
.last-tip {
  margin-top: 12px;
  font-size: 13px;
  color: var(--text-muted);
  border-top: 1px dashed var(--border);
  padding-top: 10px;
}

.home-cta {
  text-align: center;
}
.btn-lg {
  font-size: 16px;
  padding: 12px 28px;
}

.backup {
  padding: 16px 18px;
  margin-top: 18px;
  max-width: 640px;
  margin-left: auto;
  margin-right: auto;
}
.backup-title {
  font-size: 15px;
  font-weight: 600;
}
.backup-tip {
  font-size: 13px;
  color: var(--text-muted);
  margin: 6px 0 12px;
}
.backup-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.backup-msg {
  margin-top: 10px;
  font-size: 13px;
  color: var(--ok);
}
</style>