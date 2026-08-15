export const CATEGORIES = [
  { key: 'clothing', label: '服装' },
  { key: 'footwear', label: '鞋类' },
  { key: 'shelter', label: '露营' },
  { key: 'cooking', label: '炊具' },
  { key: 'electronics', label: '电子' },
  { key: 'medicine', label: '药品' },
  { key: 'food', label: '食物' },
  { key: 'other', label: '其他' },
]

export const ROUTE_TYPES = [
  { key: 'day', label: '单日线' },
  { key: 'multi', label: '多日线' },
]

export function categoryLabel(key) {
  return CATEGORIES.find((c) => c.key === key)?.label || key
}

export function routeTypeLabel(key) {
  return ROUTE_TYPES.find((t) => t.key === key)?.label || key
}

export function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
