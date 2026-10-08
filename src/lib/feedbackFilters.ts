import type { FeedbackFilterParams } from '../api/feedback'
import type { Service } from '../types'
import { toDatetimeLocal } from './feedbackStats'
import { addCondition, conditionKey, type Condition, type TimeSelectionOf } from './filterConditions'

// Filter model for the feedback overview page (spec: docs/superpowers/specs/
// 2026-09-29-feedback-overview-redesign-design.md). Pure functions only — no React.

export type TimePresetKey = '7d' | '30d' | '60d' | 'custom'

export const TIME_PRESETS: { key: TimePresetKey; label: string; days?: number }[] = [
  { key: '7d', label: '近 7 天', days: 7 },
  { key: '30d', label: '近 30 天', days: 30 },
  { key: '60d', label: '近 60 天', days: 60 },
  { key: 'custom', label: '自訂' },
]

export const DEFAULT_TIME_PRESET: TimePresetKey = '30d'

/**
 * customFrom/customTo are whole days ("YYYY-MM-DD"), only used when preset is 'custom'.
 * The range covers customFrom 00:00:00 through customTo 23:59:59.
 */
export type TimeSelection = TimeSelectionOf<TimePresetKey>

export const DEFAULT_TIME_SELECTION: TimeSelection = {
  preset: DEFAULT_TIME_PRESET,
  customFrom: '',
  customTo: '',
}

/** Resolved query range as datetime-local strings (same offset-free form the page always sent). */
export interface TimeRange {
  from: string
  to?: string
}

export function resolveTimeRange(selection: TimeSelection, now = new Date()): TimeRange {
  if (selection.preset === 'custom') {
    return {
      from: selection.customFrom ? `${selection.customFrom}T00:00:00` : '',
      to: selection.customTo ? `${selection.customTo}T23:59:59` : undefined,
    }
  }
  const days = TIME_PRESETS.find((p) => p.key === selection.preset)?.days ?? 30
  return { from: toDatetimeLocal(new Date(now.getTime() - days * 86_400_000).toISOString()) }
}

/** The equally long window right before `range` (an open-ended range ends "now"). */
export function previousTimeRange(range: TimeRange, now = new Date()): TimeRange | null {
  const from = new Date(range.from)
  const to = range.to ? new Date(range.to) : now
  const span = to.getTime() - from.getTime()
  if (Number.isNaN(span) || span <= 0) return null
  return {
    from: toDatetimeLocal(new Date(from.getTime() - span).toISOString()),
    to: range.from,
  }
}

export type ServiceConditionField = 'serviceName' | 'serviceCode' | 'serviceHost' | 'organization'
export type FeedbackConditionField = 'feedbackRating' | 'device' | 'ipCountry' | 'sessionId'
export type ConditionField = ServiceConditionField | FeedbackConditionField

export const CONDITION_FIELD_GROUPS: {
  label: string
  fields: { value: ConditionField; label: string }[]
}[] = [
  {
    label: '服務',
    fields: [
      { value: 'serviceName', label: '服務名稱' },
      { value: 'serviceCode', label: '服務代碼' },
      { value: 'serviceHost', label: '網域' },
      { value: 'organization', label: '組織' },
    ],
  },
  {
    label: '回饋資料',
    fields: [
      { value: 'feedbackRating', label: '評價' },
      { value: 'device', label: '裝置' },
      { value: 'ipCountry', label: '來源國家/地區' },
      { value: 'sessionId', label: 'Session ID' },
    ],
  },
]

export const CONDITION_FIELD_LABELS = Object.fromEntries(
  CONDITION_FIELD_GROUPS.flatMap((g) => g.fields.map((f) => [f.value, f.label])),
) as Record<ConditionField, string>

const SERVICE_FIELDS: ServiceConditionField[] = ['serviceName', 'serviceCode', 'serviceHost', 'organization']

export function isServiceField(field: ConditionField): field is ServiceConditionField {
  return (SERVICE_FIELDS as ConditionField[]).includes(field)
}

export type FilterCondition = Condition<ConditionField>

export { addCondition, conditionKey }

function serviceFieldValues(service: Service, field: ServiceConditionField): string[] {
  switch (field) {
    case 'serviceName':
      return [service.name]
    case 'serviceCode':
      return [service.code]
    case 'serviceHost':
      return [service.host]
    case 'organization':
      return [service.organizationName]
  }
}

/**
 * Service conditions narrow each other (intersection): each keeps the services whose field
 * contains its keyword (case-insensitive). Returns undefined when there are no service
 * conditions (= every visible service), or the matching codes (possibly empty).
 */
export function resolveServiceCodes(conditions: FilterCondition[], services: Service[]): string[] | undefined {
  const serviceConditions = conditions.filter((c) => isServiceField(c.field))
  if (serviceConditions.length === 0) return undefined
  return services
    .filter((service) =>
      serviceConditions.every((c) => {
        const keyword = c.value.toLowerCase()
        return serviceFieldValues(service, c.field as ServiceConditionField).some((v) =>
          (v ?? '').toLowerCase().includes(keyword),
        )
      }),
    )
    .map((s) => s.code)
}

/**
 * Builds the backend filter params. Feedback-field conditions: same field OR'd (repeated key),
 * different fields AND'd — the backend's own semantics. Returns null when the service
 * conditions match no service, so the caller can skip the requests.
 */
export function buildFeedbackFilterParams(
  conditions: FilterCondition[],
  services: Service[],
  range: TimeRange,
): FeedbackFilterParams | null {
  const serviceCodes = resolveServiceCodes(conditions, services)
  if (serviceCodes && serviceCodes.length === 0) return null

  const valuesOf = (field: FeedbackConditionField) => {
    const values = conditions.filter((c) => c.field === field).map((c) => c.value)
    return values.length ? values : undefined
  }

  return {
    serviceId: serviceCodes,
    feedbackRating: valuesOf('feedbackRating'),
    device: valuesOf('device'),
    ipCountry: valuesOf('ipCountry'),
    sessionId: valuesOf('sessionId'),
    from: range.from || undefined,
    to: range.to || undefined,
  }
}

/** What the page queries with: the time selection plus the condition list. */
export interface AppliedFeedbackFilters {
  time: TimeSelection
  conditions: FilterCondition[]
}

export const DEFAULT_APPLIED_FILTERS: AppliedFeedbackFilters = {
  time: DEFAULT_TIME_SELECTION,
  conditions: [],
}

// ---- Query string (shareable links) ----------------------------------------------------------
// ?range=7d|30d|60d|custom [&from=…&to=…] [&serviceName=測試&device=iOS …] [&page=2]
// Each condition field is its own repeated key, so links stay readable. A relative preset is
// kept relative (the recipient sees e.g. their own last 30 days); use 自訂 for fixed dates.

const ALL_CONDITION_FIELDS = CONDITION_FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.value))

export function filtersToSearchParams(filters: AppliedFeedbackFilters, page: number): URLSearchParams {
  const params = new URLSearchParams()
  const { time, conditions } = filters
  if (time.preset !== DEFAULT_TIME_PRESET) params.set('range', time.preset)
  if (time.preset === 'custom') {
    if (time.customFrom) params.set('from', time.customFrom)
    if (time.customTo) params.set('to', time.customTo)
  }
  for (const c of conditions) params.append(c.field, c.value)
  if (page > 1) params.set('page', String(page))
  return params
}

/** Anything missing or invalid falls back to the defaults (e.g. custom without `from` → 近 30 天). */
export function filtersFromSearchParams(params: URLSearchParams): {
  filters: AppliedFeedbackFilters
  page: number
} {
  const range = params.get('range')
  // Older links carried datetime-local values; keep just their date part.
  const from = (params.get('from') ?? '').slice(0, 10)
  const to = (params.get('to') ?? '').slice(0, 10)
  const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime())
  const validCustom = range === 'custom' && isDate(from) && (!to || (isDate(to) && from <= to))

  let time: TimeSelection = DEFAULT_TIME_SELECTION
  if (validCustom) {
    time = { preset: 'custom', customFrom: from, customTo: to }
  } else if (range && range !== 'custom' && TIME_PRESETS.some((p) => p.key === range)) {
    time = { ...DEFAULT_TIME_SELECTION, preset: range as TimePresetKey }
  }

  // In URL order, so chips come back in the order they were added.
  let conditions: FilterCondition[] = []
  for (const [key, value] of params) {
    if ((ALL_CONDITION_FIELDS as string[]).includes(key)) {
      conditions = addCondition(conditions, { field: key as ConditionField, value })
    }
  }

  const page = Number.parseInt(params.get('page') ?? '', 10)
  return { filters: { time, conditions }, page: Number.isFinite(page) && page > 1 ? page : 1 }
}
