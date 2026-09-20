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
  agentId: string
  agentName: string
  agentCode: string
  organizationId: string
  organizationName: string
  name: string
  code: string
  host: string
  isActive: boolean
}

export interface CreateServiceRequest {
  agentId: string
  name: string
  code: string
  host: string
}

export type UpdateServiceRequest = CreateServiceRequest

export interface User {
  id: string
  name: string
  email: string
  organizationIds: string[]
  isSystemAdmin: boolean
  twoFactorEnabled?: boolean
}

export interface CreateUser extends User {
  initialPassword: string
}

export interface AgentKeyGeneration {
  id: string
  createdAt: string
  isRevoked: boolean
  revokedAt?: string | null
}

export interface Agent {
  id: string
  organizationId: string
  code: string
  name: string
  description?: string | null
  aesKey?: string | null
  aesKeyPreview: string
  expiresAt: string
  createdAt: string
  isActive: boolean
  activeKeysCount: number
  keys: AgentKeyGeneration[]
}

export interface CreateAgentRequest {
  organizationId: string
  code: string
  name: string
  description?: string
  expiresAt: string
}

export interface UpdateAgentRequest {
  name: string
  description?: string
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

export type ImportLogStatus = 'Succeeded' | 'PartiallySucceeded' | 'Failed'

export interface ImportLog {
  id: string
  organizationId: string
  agentId?: string | null
  agentCode?: string | null
  agentName?: string | null
  keyGenerationId?: string | null
  status: ImportLogStatus
  requestedByUserId: string
  requestedAt: string
  completedAt?: string | null
  totalRecordCount: number
  succeededRecordCount: number
  failedRecordCount: number
  duplicateRecordCount: number
  errorMessage?: string | null
}

export interface ImportLogLineError {
  lineNumber: number
  reason: string
}

export interface ImportLogDetail extends ImportLog {
  failedLineSamples: ImportLogLineError[]
}