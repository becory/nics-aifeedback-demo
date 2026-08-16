export interface Organization {
  id: string
  nameZh: string
  code: string
}

export interface Service {
  id: string
  name: string
  organizationId: string
  code: string
  host: string
}

export interface User {
  id: string
  name: string
  email: string
  orgs: string[]
  isSystemAdmin: boolean
}

export interface OfflineKey {
  id: string
  organizationId: string
  description: string
  aesKey: string
  expiresAt: string
  createdAt: string
}

export type FeedbackRating = 'good' | 'normal' | 'bad'

export interface RatingScoreSetting {
  score: number
  labelZh: string
  descriptionZh: string
}

export type RatingScoresConfig = Record<FeedbackRating, RatingScoreSetting>

export interface Feedback {
  id: string
  organizationId: string
  serviceId: string
  ipAsn: string
  ipCountry: string
  ipAddress: string
  note: string
  createdAt: string
  feedbackComment: string
  userAgent: string
  feedbackRating: FeedbackRating
  inferenceSec: number
  sessionId: string
  originHost: string
  device: string
  durationSec?: number
}

export interface AppData {
  organizations: Organization[]
  services: Service[]
  users: User[]
  offlineKeys: OfflineKey[]
  feedbacks: Feedback[]
  ratingScores: RatingScoresConfig
}

export type AuthStep = 'login' | '2fa_setup' | '2fa_verify' | 'authenticated'

export interface LoginResponse {
  requiresTwoFactorSetup: boolean
  requiresTwoFactor: boolean
  pendingToken: string
}

export interface Session {
  requiresTwoFactorSetup?: boolean
  requiresTwoFactor?: boolean
  pendingToken?: string
  accessToken?: string
}

export interface Enable2FAResponse {
  sharedKey: string
  qrCodeUri: string
}

export interface TwoFactorAuthResponse {
  accessToken: string
  expiresIn: number
}