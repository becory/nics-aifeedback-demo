import type { Feedback, FeedbackRating } from '../types'
import { resolveOrganizationIdFromFeedback, serviceCodesMatch } from './entityLookups'
import type { Service } from '../types'
import { DEFAULT_RATING_SCORES, getScoreMap } from './ratingScores'

export const RATING_SCORE = getScoreMap(DEFAULT_RATING_SCORES)

export const CHART_COLORS = {
  good: '#3367d6',
  normal: '#22b8cf',
  bad: '#ef4444',
  score: '#3367d6',
  primary: '#f6821f',
  primaryLight: '#fff7ed',
}

export function getUserFeedbacks(
  feedbacks: Feedback[],
  organizationIds: string[],
): Feedback[] {
  if (!organizationIds.length) return []
  return feedbacks
    .filter((f) => organizationIds.includes(f.organizationId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function filterFeedbacksByTime(
  feedbacks: Feedback[],
  startTime: string,
  endTime: string,
): Feedback[] {
  const startMs = startTime ? new Date(startTime).getTime() : null
  const endMs = endTime ? new Date(endTime).getTime() : null
  return feedbacks.filter((f) => {
    const t = new Date(f.createdAt).getTime()
    if (startMs !== null && t < startMs) return false
    if (endMs !== null && t > endMs) return false
    return true
  })
}

export interface DailyTrafficPoint {
  date: string
  label: string
  count: number
}

export function groupFeedbacksByDay(feedbacks: Feedback[]): DailyTrafficPoint[] {
  const map = new Map<string, number>()
  for (const f of feedbacks) {
    const d = new Date(f.createdAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({
      date,
      label: formatDayLabel(date),
      count,
    }))
}

export function getAverageScore(
  feedbacks: Feedback[],
  scoreMap: Record<FeedbackRating, number> = RATING_SCORE,
): number {
  if (feedbacks.length === 0) return 0
  const total = feedbacks.reduce((sum, f) => sum + scoreMap[f.feedbackRating], 0)
  return Math.round((total / feedbacks.length) * 100) / 100
}

export interface ServiceScore {
  label: string
  score: number
}

export function getServiceAverages(
  feedbacks: Feedback[],
  scoreMap: Record<FeedbackRating, number> = RATING_SCORE,
): ServiceScore[] {
  const map = new Map<string, { total: number; count: number }>()
  for (const f of feedbacks) {
    const cur = map.get(f.serviceId) ?? { total: 0, count: 0 }
    cur.total += scoreMap[f.feedbackRating]
    cur.count += 1
    map.set(f.serviceId, cur)
  }
  return [...map.entries()]
    .map(([label, { total, count }]) => ({
      label,
      score: Math.round((total / count) * 100) / 100,
    }))
    .sort((a, b) => b.score - a.score)
}

export interface RatingCounts {
  good: number
  normal: number
  bad: number
}

export function getRatingCounts(feedbacks: Feedback[]): RatingCounts {
  const stats = { good: 0, normal: 0, bad: 0 }
  for (const f of feedbacks) stats[f.feedbackRating] += 1
  return stats
}

export interface StackedBarItem {
  label: string
  good: number
  normal: number
  bad: number
}

export function getServiceRatingStacks(feedbacks: Feedback[]): StackedBarItem[] {
  const map = new Map<string, RatingCounts>()
  for (const f of feedbacks) {
    const cur = map.get(f.serviceId) ?? { good: 0, normal: 0, bad: 0 }
    cur[f.feedbackRating] += 1
    map.set(f.serviceId, cur)
  }
  return [...map.entries()]
    .map(([label, counts]) => ({ label, ...counts }))
    .sort((a, b) => b.good + b.normal + b.bad - (a.good + a.normal + a.bad))
}

export function getGoodCountByService(feedbacks: Feedback[]): { label: string; count: number }[] {
  const map = new Map<string, number>()
  for (const f of feedbacks) {
    if (f.feedbackRating !== 'good') continue
    map.set(f.serviceId, (map.get(f.serviceId) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}

export function getDeviceRatingStacks(feedbacks: Feedback[]): StackedBarItem[] {
  const map = new Map<string, RatingCounts>()
  for (const f of feedbacks) {
    const device = f.device || '未知'
    const cur = map.get(device) ?? { good: 0, normal: 0, bad: 0 }
    cur[f.feedbackRating] += 1
    map.set(device, cur)
  }
  return [...map.entries()]
    .map(([label, counts]) => ({ label, ...counts }))
    .sort((a, b) => b.good + b.normal + b.bad - (a.good + a.normal + a.bad))
    .slice(0, 8)
}

export function countByField(
  feedbacks: Feedback[],
  field: 'ipAsn' | 'ipAddress' | 'ipCountry' | 'device' | 'serviceId' | 'originHost' | 'userAgent',
  limit = 8,
): { label: string; count: number }[] {
  const map = new Map<string, number>()
  for (const f of feedbacks) {
    const value = f[field] || '—'
    map.set(value, (map.get(value) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

function formatDayLabel(date: string): string {
  const [, m, d] = date.split('-')
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`
}

export function getFeedbackTimeRange(feedbacks: Feedback[]): { min: string; max: string } {
  if (feedbacks.length === 0) return { min: '', max: '' }
  const times = feedbacks.map((f) => new Date(f.createdAt).getTime())
  const min = Math.min(...times)
  const max = Math.max(...times)
  return {
    min: toDatetimeLocal(new Date(min).toISOString()),
    max: toDatetimeLocal(new Date(max).toISOString()),
  }
}

export function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function truncateLabel(label: string, max = 22): string {
  return label.length > max ? `${label.slice(0, max)}…` : label
}

export type StatsFilterField =
  | 'ipAddress'
  | 'ipAsn'
  | 'ipCountry'
  | 'originHost'
  | 'serviceId'
  | 'organization'
  | 'device'
  | 'userAgent'
  | 'feedbackRating'

export interface StatsFilterContext {
  serviceByCode: Map<string, Service>
}

export interface DimensionFilter {
  id: string
  field: StatsFilterField
  value: string
  mode: 'include' | 'exclude'
  label: string
}

export const STATS_FIELD_LABELS: Record<StatsFilterField, string> = {
  ipAddress: '客戶端 IP 位址',
  ipAsn: '主要來源 ASN',
  ipCountry: '來源國家/地區',
  originHost: '主機',
  serviceId: '服務',
  organization: '組織',
  device: '裝置',
  userAgent: '使用者代理程式',
  feedbackRating: '評價',
}

export type TimePreset = 'all' | '7d' | '30d' | '6m' | '1y'

export const DEFAULT_TIME_PRESET: TimePreset = '30d'

export const TIME_PRESET_LABELS: Record<TimePreset, string> = {
  all: '所有時間',
  '7d': '最近 7 天',
  '30d': '最近 30 天',
  '6m': '最近半年',
  '1y': '最近一年',
}

const PRESET_DAYS: Partial<Record<TimePreset, number>> = {
  '7d': 7,
  '30d': 30,
}

export function getTimeRangeForPreset(
  preset: TimePreset,
  bounds: { min: string; max: string },
): { start: string; end: string } {
  if (preset === 'all' || !bounds.max) return { start: '', end: '' }

  const end = new Date(bounds.max)
  const start = new Date(end)

  const days = PRESET_DAYS[preset]
  if (days !== undefined) {
    start.setDate(start.getDate() - days)
  } else if (preset === '6m') {
    start.setMonth(start.getMonth() - 6)
  } else if (preset === '1y') {
    start.setFullYear(start.getFullYear() - 1)
  }

  const minDate = bounds.min ? new Date(bounds.min) : start
  if (start < minDate) start.setTime(minDate.getTime())

  return {
    start: toDatetimeLocal(start.toISOString()),
    end: toDatetimeLocal(end.toISOString()),
  }
}

export function getFeedbackFieldValue(
  fb: Feedback,
  field: StatsFilterField,
  ctx?: StatsFilterContext,
): string {
  if (field === 'feedbackRating') return fb.feedbackRating
  if (field === 'organization') {
    const serviceByCode = ctx?.serviceByCode ?? new Map()
    return resolveOrganizationIdFromFeedback(fb, serviceByCode)
  }
  const v = fb[field]
  return v || '—'
}

export function applyDimensionFilters(
  feedbacks: Feedback[],
  filters: DimensionFilter[],
  ctx?: StatsFilterContext,
): Feedback[] {
  if (!filters.length) return feedbacks
  return feedbacks.filter((fb) =>
    filters.every((f) => {
      const val = getFeedbackFieldValue(fb, f.field, ctx)
      const match =
        f.field === 'serviceId' ? serviceCodesMatch(val, f.value) : val === f.value
      return f.mode === 'include' ? match : !match
    }),
  )
}

export function formatCompactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return n.toLocaleString()
}
