import defaultFeedbacksJson from '../data/defaultFeedbacks.json'
import type { Feedback, Service } from '../types'
import { findServiceByCode } from './entityLookups'

type DefaultFeedbackRow = Omit<Feedback, 'id' | 'organizationId'>

const defaultFeedbacks = defaultFeedbacksJson as DefaultFeedbackRow[]

export function createDefaultFeedbacks(
  services: Service[],
  fallbackOrganizationId: string,
): Feedback[] {
  return defaultFeedbacks.map((item) => {
    const svc = findServiceByCode(item.serviceId, services)
    return {
      ...item,
      id: item.sessionId,
      organizationId: svc?.organizationId ?? fallbackOrganizationId,
    }
  })
}

export function mergeDefaultFeedbacks(
  services: Service[],
  fallbackOrganizationId: string,
  existing: Feedback[],
): Feedback[] {
  const existingSessionIds = new Set(existing.map((f) => f.sessionId))
  const toAdd = createDefaultFeedbacks(services, fallbackOrganizationId).filter(
    (f) => !existingSessionIds.has(f.sessionId),
  )
  return [...existing, ...toAdd]
}

export const DEFAULT_FEEDBACK_COUNT = defaultFeedbacks.length
