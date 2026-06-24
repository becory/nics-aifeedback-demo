import type { AppData, User } from '../types'
import { hashPassword } from './crypto'
import { createDefaultFeedbacks, mergeDefaultFeedbacks } from './defaultFeedbacks'
import { syncFeedbackOrganizations } from './entityLookups'
import { DEFAULT_RATING_SCORES, normalizeRatingScores } from './ratingScores'
import { createTotpSecret } from './totp'

const DATA_KEY = 'aifeedback_data'

export const DEFAULT_ADMIN_ID = 'admin-user'
export const DEFAULT_ADMIN_TOTP_SECRET = 'VXSSSCOGZGVZST3CUPFL62W263ZD6RUW'

async function createDefaultData(): Promise<AppData> {
  return {
    organizations: [],
    services: [],
    offlineKeys: [],
    feedbacks: [],
    ratingScores: DEFAULT_RATING_SCORES,
    users: [
      {
        id: DEFAULT_ADMIN_ID,
        nameZh: '系統管理員',
        email: 'admin',
        passwordHash: await hashPassword('admin'),
        totpSecret: DEFAULT_ADMIN_TOTP_SECRET,
        totpEnabled: false,
        organizationIds: [],
        isAdmin: true,
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
  const testService = data.services.find((s) => s.code.toLowerCase() === 'test')
  if (testService) {
    const before = data.feedbacks.length
    if (before === 0) {
      data.feedbacks = createDefaultFeedbacks(data.services, testService.organizationId)
    } else {
      data.feedbacks = mergeDefaultFeedbacks(data.services, testService.organizationId, data.feedbacks)
    }
    const synced = syncFeedbackOrganizations(data.feedbacks, data.services)
    if (synced.some((fb, i) => fb.organizationId !== data.feedbacks[i]?.organizationId)) {
      data.feedbacks = synced
      migrated = true
    }
    if (data.feedbacks.length !== before) migrated = true
  } else if (data.feedbacks.length > 0) {
    const synced = syncFeedbackOrganizations(data.feedbacks, data.services)
    if (synced.some((fb, i) => fb.organizationId !== data.feedbacks[i]?.organizationId)) {
      data.feedbacks = synced
      migrated = true
    }
  }
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
