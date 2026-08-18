export interface Organization {
    id: string
    name: string
    code: string
    isActive: boolean
}

export interface CreateOrganizationRequest {
  name: string
  code: string
}

export type UpdateOrganizationRequest = CreateOrganizationRequest

export interface Service {
  id: string
  name: string
  organizationId: string
  code: string
  host: string
}

export interface CreateServiceRequest {
  orgId: string
  name: string
  code: string
  receivingDomain: string
}

export type UpdateServiceRequest = CreateServiceRequest

export interface User {
  id: string
  name: string
  email: string
  organizationIds: string[]
  isSystemAdmin: boolean
  mfaExempt: boolean
}

export interface CreateUser extends User {
  initialPassword: string
}

export interface OfflineKey {
  id: string
  organizationId: string
  description: string
  aesKey: string
  expiresAt: string
  createdAt: string
}

export interface CreateOfflineKeyRequest {
  orgId: string
  description: string
  expiresAt: string
}

export interface UpdateOfflineKeyRequest {
  description: string
  expiresAt: string
}

export interface ScoreConfig {
  id: string
  name: string
  description: string
  scoreValue: number
}

export interface UpdateScoreConfigRequest {
  name: string
  description: string
  scoreValue: number
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

export interface DataResponse<T> {
  data: T
  message?: string
  error?: string
}