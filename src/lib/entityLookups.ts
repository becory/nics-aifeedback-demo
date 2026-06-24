import type { Feedback, Organization, Service } from '../types'

export function normalizeServiceCode(code: string): string {
  return (code || '—').trim().toLowerCase()
}

export function findServiceByCode(code: string, services: Service[]): Service | undefined {
  const normalized = normalizeServiceCode(code)
  if (normalized === '—') return undefined
  return services.find((s) => s.code.toLowerCase() === normalized)
}

export function buildServiceByCodeMap(services: Service[]): Map<string, Service> {
  return new Map(services.map((s) => [s.code.toLowerCase(), s]))
}

export function formatServiceLabel(serviceCode: string, services: Service[]): string {
  const code = serviceCode || '—'
  const svc = findServiceByCode(code, services)
  if (svc) return `${svc.name} (${svc.code})`
  return `未知 (${code})`
}

export function formatOrganizationLabel(orgId: string, organizations: Organization[]): string {
  const org = organizations.find((o) => o.id === orgId)
  if (org) return `${org.nameZh} (${org.code})`
  const byCode = organizations.find((o) => o.code.toLowerCase() === orgId.toLowerCase())
  if (byCode) return `${byCode.nameZh} (${byCode.code})`
  return `未知 (${orgId})`
}

export function resolveOrganizationIdFromFeedback(
  fb: Feedback,
  serviceByCode: Map<string, Service>,
): string {
  const svc = serviceByCode.get(normalizeServiceCode(fb.serviceId))
  if (svc) return svc.organizationId
  return fb.organizationId
}

export function resolveOrganizationIdFromFeedbackWithServices(
  fb: Feedback,
  services: Service[],
): string {
  const svc = findServiceByCode(fb.serviceId, services)
  if (svc) return svc.organizationId
  return fb.organizationId
}

export function syncFeedbackOrganizations(feedbacks: Feedback[], services: Service[]): Feedback[] {
  return feedbacks.map((fb) => {
    const svc = findServiceByCode(fb.serviceId, services)
    if (!svc || fb.organizationId === svc.organizationId) return fb
    return { ...fb, organizationId: svc.organizationId }
  })
}

export interface LookupStatsItem {
  label: string
  value: string
  count: number
}

export function countByServiceId(
  feedbacks: Feedback[],
  services: Service[],
  limit?: number,
): LookupStatsItem[] {
  const map = new Map<string, { count: number; displayCode: string }>()
  for (const f of feedbacks) {
    const normalized = normalizeServiceCode(f.serviceId)
    const svc = findServiceByCode(f.serviceId, services)
    const displayCode = svc?.code ?? (f.serviceId || '—')
    const cur = map.get(normalized) ?? { count: 0, displayCode }
    cur.count += 1
    if (svc) cur.displayCode = svc.code
    map.set(normalized, cur)
  }
  const sorted = [...map.entries()]
    .map(([, { count, displayCode }]) => ({
      label: formatServiceLabel(displayCode, services),
      value: displayCode,
      count,
    }))
    .sort((a, b) => b.count - a.count)
  return limit != null ? sorted.slice(0, limit) : sorted
}

export function countByOrganizationViaService(
  feedbacks: Feedback[],
  services: Service[],
  organizations: Organization[],
  limit?: number,
): LookupStatsItem[] {
  const serviceByCode = buildServiceByCodeMap(services)
  const map = new Map<string, number>()
  for (const f of feedbacks) {
    const orgId = resolveOrganizationIdFromFeedback(f, serviceByCode)
    map.set(orgId, (map.get(orgId) ?? 0) + 1)
  }
  const sorted = [...map.entries()]
    .map(([orgId, count]) => ({
      label: formatOrganizationLabel(orgId, organizations),
      value: orgId,
      count,
    }))
    .sort((a, b) => b.count - a.count)
  return limit != null ? sorted.slice(0, limit) : sorted
}

export function serviceCodesMatch(a: string, b: string): boolean {
  return normalizeServiceCode(a) === normalizeServiceCode(b)
}
