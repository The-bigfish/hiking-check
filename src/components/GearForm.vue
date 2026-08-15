<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { CATEGORIES } from '../utils/constants'
import Modal from './Modal.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  initial: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'submit'])

const form = reactive({
  name: '',
  category: 'other',
  quantity: 1,
  weight: '',
  note: '',
})
const error = ref('')

const isEdit = computed(() => !!props.initial)

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      error.value = ''
      if (props.initial) {
        Object.assign(form, {
          name: props.initial.name,
          category: props.initial.category,
          quantity: props.initial.quantity,
          weight: props.initial.weight ?? '',
          note: props.initial.note ?? '',
        })
      } else {
        Object.assign(form, { name: '', category: 'other', quantity: 1, weight: '', note: '' })
      }
    }
  },
)

function submit() {
  if (!form.name.trim()) {
    error.value = '请填写装备名称'
    return
  }
  emit('submit', {
    name: form.name.trim(),
    category: form.category,
    quantity: Number(form.quantity) || 1,
    weight: form.weight === '' ? null : Number(form.weight),
    note: form.note.trim(),
  })
}
</script>

<template>
  <Modal v-if="modelValue" :title="isEdit ? '编辑装备' : '新增装备'" @close="emit('update:modelValue', false)">
    <form @submit.prevent="submit">
      <div class="field">
        <label>名称 *</label>
        <input v-model.trim="form.name" placeholder="如：登山杖、冲锋衣" />
      </div>
      <div class="field">
        <label>分类</label>
        <select v-model="form.category">
          <option v-for="c in CATEGORIES" :key="c.key" :value="c.key">{{ c.label }}</option>
        </select>
      </div>
      <div class="field">
        <label>数量</label>
        <input type="number" min="1" v-model.number="form.quantity" />
      </div>
      <div class="field">
        <label>重量（克）</label>
        <input type="number" min="0" v-model="form.weight" placeholder="可选" />
      </div>
      <div class="field">
        <label>备注</label>
        <textarea rows="2" v-model.trim="form.note" placeholder="可选"></textarea>
      </div>
      <p v-if="error" class="form-error">{{ error }}</p>
    </form>
    <template #foot>
      <button type="button" class="btn btn-ghost" @click="emit('update:modelValue', false)">取消</button>
      <button type="button" class="btn btn-primary" @click="submit">{{ isEdit ? '保存' : '添加' }}</button>
    </template>
  </Modal>
</template>

<style scoped>
.form-error {
  color: var(--danger);
  font-size: 13px;
  margin: 0 0 8px;
}
</style>