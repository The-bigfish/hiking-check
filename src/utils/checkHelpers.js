export function applyRecordStateToChecks(checks, savedItems) {
  if (!Array.isArray(savedItems)) return
  for (const c of checks) {
    const s =
      savedItems.find((x) => x.gear_id && x.gear_id === c.gear_id) ||
      savedItems.find((x) => x.name === c.name)
    if (s) c.checked = !!s.checked
  }
}

export function buildItemsSnapshot(checks) {
  return checks.map((c) => ({
    gear_id: c.gear_id,
    name: c.name,
    category: c.category,
    required: c.required,
    quantity: c.quantity,
    checked: c.checked,
  }))
}