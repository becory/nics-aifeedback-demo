// Generic filter-condition helpers shared by the filter bars (feedback overview, audit logs).

export interface Condition<F extends string = string> {
  field: F
  value: string
}

export function conditionKey(c: Condition): string {
  return `${c.field}:${c.value}`
}

/**
 * Adds `condition` unless its value is blank or the same field+value is already listed.
 * With `single`, any existing condition on that field is replaced (single-valued filters).
 * Returns the same array when nothing changed, so callers can skip a re-query.
 */
export function addCondition<C extends Condition>(list: C[], condition: C, single = false): C[] {
  const value = condition.value.trim()
  if (!value) return list
  const next = { ...condition, value }
  if (list.some((c) => conditionKey(c) === conditionKey(next))) return list
  return [...(single ? list.filter((c) => c.field !== next.field) : list), next]
}

/** Custom time range: both ends as datetime-local strings ("" = open). */
export interface TimeSelectionOf<P extends string> {
  preset: P
  customFrom: string
  customTo: string
}
