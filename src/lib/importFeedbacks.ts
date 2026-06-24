import type { Feedback, FeedbackRating, Organization, Service } from '../types'
import { findServiceByCode, syncFeedbackOrganizations } from './entityLookups'
import { getDefaultFeedbackFallbackOrgId } from './defaultSeedData'

export interface ImportFeedbacksResult {
  added: number
  skipped: number
  errors: string[]
}

type ImportRow = Record<string, unknown>

function normalizeRating(value: unknown): FeedbackRating {
  const v = String(value ?? 'normal').toLowerCase()
  if (v === 'good' || v === 'bad') return v
  return 'normal'
}

function normalizeRow(
  row: ImportRow,
  index: number,
  services: Service[],
  fallbackOrgId: string,
): { feedback?: Feedback; error?: string } {
  const sessionId = String(row.sessionId ?? row.id ?? '').trim()
  if (!sessionId) {
    return { error: `第 ${index + 1} 筆：缺少 sessionId` }
  }

  const serviceId = String(row.serviceId ?? '').trim()
  if (!serviceId) {
    return { error: `第 ${index + 1} 筆：缺少 serviceId` }
  }

  const createdAt = String(row.createdAt ?? '').trim()
  if (!createdAt) {
    return { error: `第 ${index + 1} 筆：缺少 createdAt` }
  }

  const svc = findServiceByCode(serviceId, services)
  const organizationId = svc?.organizationId ?? fallbackOrgId

  return {
    feedback: {
      id: sessionId,
      organizationId,
      serviceId: svc?.code ?? serviceId,
      sessionId,
      createdAt,
      feedbackRating: normalizeRating(row.feedbackRating),
      feedbackComment: String(row.feedbackComment ?? ''),
      note: String(row.note ?? ''),
      ipAsn: String(row.ipAsn ?? ''),
      ipCountry: String(row.ipCountry ?? ''),
      ipAddress: String(row.ipAddress ?? ''),
      userAgent: String(row.userAgent ?? ''),
      originHost: String(row.originHost ?? ''),
      device: String(row.device ?? ''),
      inferenceSec: Number(row.inferenceSec) || 0,
      durationSec: row.durationSec != null ? Number(row.durationSec) : undefined,
    },
  }
}

export function parseImportFeedbacksJson(
  jsonText: string,
  services: Service[],
  organizations: Organization[],
  existing: Feedback[],
): { items: Feedback[]; result: ImportFeedbacksResult } {
  const result: ImportFeedbacksResult = { added: 0, skipped: 0, errors: [] }
  const fallbackOrgId = getDefaultFeedbackFallbackOrgId(organizations) ?? organizations[0]?.id ?? ''

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    return { items: existing, result: { ...result, errors: ['JSON 格式無效'] } }
  }

  if (!Array.isArray(parsed)) {
    return { items: existing, result: { ...result, errors: ['資料須為 JSON 陣列'] } }
  }

  if (parsed.length === 0) {
    return { items: existing, result: { ...result, errors: ['匯入資料為空'] } }
  }

  const existingSessionIds = new Set(existing.map((f) => f.sessionId))
  const toAdd: Feedback[] = []

  parsed.forEach((row, index) => {
    if (!row || typeof row !== 'object') {
      result.errors.push(`第 ${index + 1} 筆：格式錯誤`)
      return
    }

    const normalized = normalizeRow(row as ImportRow, index, services, fallbackOrgId)
    if (normalized.error) {
      result.errors.push(normalized.error)
      return
    }
    if (!normalized.feedback) return

    if (existingSessionIds.has(normalized.feedback.sessionId)) {
      result.skipped += 1
      return
    }

    existingSessionIds.add(normalized.feedback.sessionId)
    toAdd.push(normalized.feedback)
    result.added += 1
  })

  if (toAdd.length === 0) {
    return { items: existing, result }
  }

  const merged = syncFeedbackOrganizations([...existing, ...toAdd], services)
  return { items: merged, result }
}
