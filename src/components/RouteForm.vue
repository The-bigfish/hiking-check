<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { useGearStore } from '../stores/gear'
import { CATEGORIES, ROUTE_TYPES, categoryLabel } from '../utils/constants'
import Modal from './Modal.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  initial: { type: Object, default: null },
  currentItems: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue', 'submit'])

const gearStore = useGearStore()

const form = reactive({ name: '', type: 'day', desc: '' })
const selection = ref([]) // [{ gear_id, included, required, quantity }]
const error = ref('')

const isEdit = computed(() => !!props.initial)

const selectedCount = computed(() => selection.value.filter((s) => s.included).length)

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      error.value = ''
      Object.assign(form, {
        name: props.initial?.name || '',
        type: props.initial?.type || 'day',
        desc: props.initial?.desc || '',
      })
      const existing = {}
      for (const it of props.currentItems) existing[it.gear_id] = it
      selection.value = gearStore.items.map((g) => ({
        gear_id: g.id,
        included: !!existing[g.id],
        required: existing[g.id] ? !!existing[g.id].required : g.category !== 'other',
        quantity: existing[g.id] ? existing[g.id].quantity : g.quantity || 1,
      }))
    }
  },
)

function toggle(id, val) {
  const s = selection.value.find((x) => x.gear_id === id)
  if (s) s.included = val
}

function submit() {
  if (!form.name.trim()) {
    error.value = '请填写路线名称'
    return
  }
  const items = selection.value
    .filter((s) => s.included)
    .map((s) => ({ gear_id: s.gear_id, required: s.required, quantity: s.quantity || 1 }))
  emit('submit', {
    name: form.name.trim(),
    type: form.type,
    desc: form.desc.trim(),
    items,
  })
}
</script>

<template>
  <Modal v-if="modelValue" :title="isEdit ? '编辑路线' : '新增路线'" @close="emit('update:modelValue', false)">
    <form @submit.prevent="submit">
      <div class="field">
        <label>路线名称 *</label>
        <input v-model.trim="form.name" placeholder="如：黄山单日线 / 贡嘎多日线" />
      </div>
      <div class="field">
        <label>类型</label>
        <select v-model="form.type">
          <option v-for="t in ROUTE_TYPES" :key="t.key" :value="t.key">{{ t.label }}</option>
        </select>
      </div>
      <div class="field">
        <label>备注</label>
        <textarea rows="2" v-model.trim="form.desc" placeholder="可选"></textarea>
      </div>
    </form>

    <div class="gear-pick-head">
      <span>路线装备（已选 {{ selectedCount }} 件）</span>
      <span class="gear-pick-hint">勾选包含的装备，再标记是否必带</span>
    </div>

    <div v-if="!selection.length" class="card empty">
      <p>装备库为空，请先到「装备库」添加装备</p>
    </div>

    <div v-else class="gear-pick">
      <div v-for="s in selection" :key="s.gear_id" class="gear-pick-row" :class="{ picked: s.included }">
        <label class="check">
          <input type="checkbox" :checked="s.included" @change="toggle(s.gear_id, $event.target.checked)" />
          <span class="gear-pick-name">{{ gearStore.byId(s.gear_id)?.name }}</span>
        </label>
        <span class="tag">{{ categoryLabel(gearStore.byId(s.gear_id)?.category) }}</span>
        <span class="gear-pick-extra">
          <label class="check check-sm">
            <input type="checkbox" v-model="s.required" :disabled="!s.included" />
            必带
          </label>
          <input
            v-model.number="s.quantity"
            type="number"
            min="1"
            class="qty"
            :disabled="!s.included"
            title="数量"
          />
        </span>
      </div>
    </div>

    <p v-if="error" class="form-error">{{ error }}</p>

    <template #foot>
      <button type="button" class="btn btn-ghost" @click="emit('update:modelValue', false)">取消</button>
      <button type="button" class="btn btn-primary" @click="submit" :disabled="!selection.length">保存</button>
    </template>
  </Modal>
</template>

<style scoped>
.form-error {
  color: var(--danger);
  font-size: 13px;
  margin: 8px 0 0;
}
.gear-pick-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 8px 0 10px;
  font-size: 14px;
  font-weight: 600;
}
.gear-pick-hint {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 400;
}
.gear-pick {
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.gear-pick-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}
.gear-pick-row:last-child {
  border-bottom: none;
}
.gear-pick-row.picked {
  background: var(--primary-soft);
}
.check {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}
.check-sm {
  flex: none;
  font-size: 13px;
  color: var(--text-muted);
}
.gear-pick-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gear-pick-extra {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.qty {
  width: 52px;
  padding: 4px 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
}
input[type='checkbox'] {
  accent-color: var(--primary);
  width: 16px;
  height: 16px;
}
</style>