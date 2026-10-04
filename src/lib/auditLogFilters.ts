import type { GetAuditLogsParams } from '../api/auditLogs'
import { AUDIT_EVENT_CATEGORIES, AUDIT_QUERY_EVENT_TYPE } from './auditLog'
import { toDatetimeLocal } from './feedbackStats'
import { addCondition, type Condition, type TimeSelectionOf } from './filterConditions'

// Filter model for the audit log page, on the shared FilterBar (same interaction as the
// feedback overview). Pure functions only — no React.

export type AuditTimePreset = '24h' | '7d' | '30d' | 'custom'

export const AUDIT_TIME_PRESETS: { key: AuditTimePreset; label: string; hours?: number }[] = [
  { key: '24h', label: '近 24 小時', hours: 24 },
  { key: '7d', label: '近 7 天', hours: 24 * 7 },
  // Cloud Logging keeps ~30 days, so nothing longer is offered.
  { key: '30d', label: '近 30 天', hours: 24 * 30 },
  { key: 'custom', label: '自訂' },
]

export const DEFAULT_AUDIT_TIME_PRESET: AuditTimePreset = '7d'

export type AuditFilterField =
  | 'category'
  | 'minSeverity'
  | 'userId'
  | 'userEmail'
  | 'targetUserId'
  | 'organizationId'
  | 'clientIp'

export const AUDIT_FILTER_FIELDS: AuditFilterField[] = [
  'category',
  'minSeverity',
  'userId',
  'userEmail',
  'targetUserId',
  'organizationId',
  'clientIp',
]

/** minSeverity is a single value in the API; the others repeat (OR within a field). */
export const SINGLE_VALUE_AUDIT_FIELDS: AuditFilterField[] = ['minSeverity']

export const AUDIT_SEVERITY_OPTIONS = [
  { value: 'WARNING', label: '警告以上' },
  { value: 'ERROR', label: '錯誤以上' },
]

export interface AuditLogFilters {
  time: TimeSelectionOf<AuditTimePreset>
  conditions: Condition<AuditFilterField>[]
  /** Leave out 「查詢稽核日誌」 events (every query writes one). */
  hideAuditQueries: boolean
}

export const DEFAULT_AUDIT_LOG_FILTERS: AuditLogFilters = {
  time: { preset: DEFAULT_AUDIT_TIME_PRESET, customFrom: '', customTo: '' },
  conditions: [],
  hideAuditQueries: true,
}

/** from/to as datetime-local strings; relative presets are resolved against `now`. */
export function resolveAuditTimeRange(
  time: AuditLogFilters['time'],
  now = new Date(),
): { from: string; to?: string } {
  if (time.preset === 'custom') return { from: time.customFrom, to: time.customTo || undefined }
  const hours = AUDIT_TIME_PRESETS.find((p) => p.key === time.preset)?.hours ?? 24 * 7
  return { from: toDatetimeLocal(new Date(now.getTime() - hours * 3600_000).toISOString()) }
}

export function buildAuditLogParams(filters: AuditLogFilters, pageSize: number): GetAuditLogsParams {
  const valuesOf = (field: AuditFilterField) => {
    const values = filters.conditions.filter((c) => c.field === field).map((c) => c.value)
    return values.length ? values : undefined
  }

  const eventType = AUDIT_EVENT_CATEGORIES.filter((c) =>
    filters.conditions.some((x) => x.field === 'category' && x.value === c.value),
  ).flatMap((c) => c.prefixes)
  if (filters.hideAuditQueries) eventType.push(`-${AUDIT_QUERY_EVENT_TYPE}`)

  const range = resolveAuditTimeRange(filters.time)
  return {
    eventType: eventType.length ? eventType : undefined,
    minSeverity: valuesOf('minSeverity')?.[0] as GetAuditLogsParams['minSeverity'],
    userId: valuesOf('userId'),
    userEmail: valuesOf('userEmail'),
    targetUserId: valuesOf('targetUserId'),
    organizationId: valuesOf('organizationId'),
    clientIp: valuesOf('clientIp'),
    // Audit timestamps are UTC; send the local picker time as an explicit instant.
    from: range.from ? new Date(range.from).toISOString() : undefined,
    to: range.to ? new Date(range.to).toISOString() : undefined,
    pageSize,
  }
}

// ---- Query string (shareable links), same scheme as the feedback overview ----
// ?range=24h|30d|custom [&from=…&to=…] [&category=auth&userId=…] [&showQueries=1]

export function auditFiltersToSearchParams(filters: AuditLogFilters): URLSearchParams {
  const params = new URLSearchParams()
  const { time, conditions } = filters
  if (time.preset !== DEFAULT_AUDIT_TIME_PRESET) params.set('range', time.preset)
  if (time.preset === 'custom') {
    if (time.customFrom) params.set('from', time.customFrom)
    if (time.customTo) params.set('to', time.customTo)
  }
  for (const c of conditions) params.append(c.field, c.value)
  if (!filters.hideAuditQueries) params.set('showQueries', '1')
  return params
}

/** Anything missing or invalid falls back to the defaults. */
export function auditFiltersFromSearchParams(params: URLSearchParams): AuditLogFilters {
  const range = params.get('range')
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const validCustom =
    range === 'custom' && !Number.isNaN(new Date(from).getTime()) && (!to || new Date(from) <= new Date(to))

  let time = DEFAULT_AUDIT_LOG_FILTERS.time
  if (validCustom) {
    time = { preset: 'custom', customFrom: from, customTo: to }
  } else if (range && range !== 'custom' && AUDIT_TIME_PRESETS.some((p) => p.key === range)) {
    time = { ...time, preset: range as AuditTimePreset }
  }

  let conditions: Condition<AuditFilterField>[] = []
  for (const [key, value] of params) {
    if ((AUDIT_FILTER_FIELDS as string[]).includes(key)) {
      const field = key as AuditFilterField
      conditions = addCondition(conditions, { field, value }, SINGLE_VALUE_AUDIT_FIELDS.includes(field))
    }
  }

  return { time, conditions, hideAuditQueries: params.get('showQueries') !== '1' }
}
