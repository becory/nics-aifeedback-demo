import type { AppData, User } from '../types'
import { hashPassword } from './crypto'
import { createDefaultFeedbacks, mergeDefaultFeedbacks } from './defaultFeedbacks'
import {
  createDefaultOrganizations,
  createDefaultServices,
  getDefaultAdminOrganizationIds,
  getDefaultFeedbackFallbackOrgId,
} from './defaultSeedData'
import { syncFeedbackOrganizations } from './entityLookups'
import { DEFAULT_RATING_SCORES, normalizeRatingScores } from './ratingScores'
import { createTotpSecret } from './totp'

const DATA_KEY = 'aifeedback_data'

export const DEFAULT_ADMIN_ID = 'admin-user'
export const DEFAULT_ADMIN_TOTP_SECRET = 'VXSSSCOGZGVZST3CUPFL62W263ZD6RUW'

function seedFeedbacks(data: AppData): boolean {
  const fallbackOrgId = getDefaultFeedbackFallbackOrgId(data.organizations)
  if (!data.services.length || !fallbackOrgId) return false

  const before = data.feedbacks.length
  if (before === 0) {
    data.feedbacks = createDefaultFeedbacks(data.services, fallbackOrgId)
  } else {
    data.feedbacks = mergeDefaultFeedbacks(data.services, fallbackOrgId, data.feedbacks)
  }

  const synced = syncFeedbackOrganizations(data.feedbacks, data.services)
  const orgChanged = synced.some((fb, i) => fb.organizationId !== data.feedbacks[i]?.organizationId)
  if (orgChanged) data.feedbacks = synced

  return data.feedbacks.length !== before || orgChanged
}

async function createDefaultData(): Promise<AppData> {
  const organizations = createDefaultOrganizations()
  const services = createDefaultServices()
  const fallbackOrgId = getDefaultFeedbackFallbackOrgId(organizations)

  return {
    organizations,
    services,
    offlineKeys: [],
    feedbacks: fallbackOrgId ? createDefaultFeedbacks(services, fallbackOrgId) : [],
    ratingScores: DEFAULT_RATING_SCORES,
    users: [
      {
        id: DEFAULT_ADMIN_ID,
        name: '系統管理員',
        email: 'admin',
        orgs: getDefaultAdminOrganizationIds(),
        isSystemAdmin: true,
      },
    ],
  }
}

export async function initStorage(): Promise<AppData> {
  const raw = localStorage.getItem(DATA_KEY)
  if (!raw) {
    const data = await createDefaultData()
    localStorage.setItem(DATA_KEY, JSON.stringify(data))
    return data
  }
  const data = JSON.parse(raw) as AppData
  let migrated = false
  const admin = data.users.find((u) => u.id === DEFAULT_ADMIN_ID)
  if (admin && !admin.totpSecret) {
    admin.totpSecret = DEFAULT_ADMIN_TOTP_SECRET
    migrated = true
  }
  for (const service of data.services) {
    if (service.host === undefined) {
      service.host = ''
      migrated = true
    }
  }
  if (!data.offlineKeys) {
    data.offlineKeys = []
    migrated = true
  }
  for (const key of data.offlineKeys) {
    if (key.description === undefined) {
      key.description = ''
      migrated = true
    }
  }
  if (!data.feedbacks) {
    data.feedbacks = []
    migrated = true
  }
  if (!data.ratingScores) {
    data.ratingScores = DEFAULT_RATING_SCORES
    migrated = true
  } else {
    const normalized = normalizeRatingScores(data.ratingScores)
    if (JSON.stringify(normalized) !== JSON.stringify(data.ratingScores)) {
      data.ratingScores = normalized
      migrated = true
    }
  }
  if (data.organizations.length === 0) {
    data.organizations = createDefaultOrganizations()
    migrated = true
  }
  if (data.services.length === 0) {
    data.services = createDefaultServices()
    migrated = true
  }
  const adminUser = data.users.find((u) => u.id === DEFAULT_ADMIN_ID)
  if (adminUser && adminUser.organizationIds.length === 0 && data.organizations.length > 0) {
    adminUser.organizationIds = getDefaultAdminOrganizationIds()
    migrated = true
  }
  if (seedFeedbacks(data)) migrated = true
  if (migrated) saveData(data)
  return data
}

export function getData(): AppData {
  const raw = localStorage.getItem(DATA_KEY)
  if (!raw) throw new Error('Storage not initialized')
  return JSON.parse(raw) as AppData
}

export function saveData(data: AppData): void {
  localStorage.setItem(DATA_KEY, JSON.stringify(data))
}

export function findUserByLogin(login: string): User | undefined {
  const data = getData()
  const normalized = login.trim().toLowerCase()
  return data.users.find(
    (u) =>
      u.email.toLowerCase() === normalized ||
      u.email.split('@')[0].toLowerCase() === normalized,
  )
}

export function updateUser(userId: string, patch: Partial<User>): void {
  const data = getData()
  const idx = data.users.findIndex((u) => u.id === userId)
  if (idx === -1) return
  data.users[idx] = { ...data.users[idx], ...patch }
  saveData(data)
}

export function resetUserTotp(userId: string): void {
  const data = getData()
  const user = data.users.find((u) => u.id === userId)
  if (!user) return

  user.totpEnabled = false
  user.totpSecret =
    userId === DEFAULT_ADMIN_ID ? DEFAULT_ADMIN_TOTP_SECRET : createTotpSecret()
  saveData(data)
}
