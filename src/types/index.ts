export interface Organization {
    id: string
    name: string
    code: string
    isActive: boolean
    /** Same count as GET /services?organizationId=… for the same caller (computed on read). */
    serviceCount?: number
}

export interface CreateOrganizationRequest {
  name: string
  code: string
}

export type UpdateOrganizationRequest = CreateOrganizationRequest

export interface Service {
  id: string
  organizationId: string
  organizationName: string
  name: string
  code: string
  host: string
  isActive: boolean
}

export interface CreateServiceRequest {
  /** Can change on update: the service (and all its feedback) moves to the new organization. */
  organizationId: string
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

/** An organization's offline-import key. Never carries the full key except right after creation. */
export interface OrganizationKey {
  /** uuid; the key_id the Agent CLI writes into export envelopes. */
  id: string
  organizationId: string
  description?: string | null
  keyPreview: string
  createdAt: string
  expiresAt: string
  isRevoked: boolean
  revokedAt?: string | null
}

/** Only the create response carries the full aesKey. */
export interface CreatedOrganizationKey extends OrganizationKey {
  aesKey: string
}

export interface CreateOrganizationKeyRequest {
  description?: string
  expiresAt: string
}

export interface UpdateOrganizationKeyRequest {
  /** Null/blank clears it. */
  description?: string | null
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
  /** Cursor-paged lists only (e.g. audit logs): pass back as pageToken; absent on the last page. */
  nextPageToken?: string
}

export type AuditSeverity = 'DEFAULT' | 'DEBUG' | 'INFO' | 'NOTICE' | 'WARNING' | 'ERROR' | 'CRITICAL' | 'ALERT' | 'EMERGENCY'

export interface AuditLogEntry {
  insertId: string
  timestamp: string
  severity: AuditSeverity | string
  eventType?: string | null
  description?: string | null
  /** Always the acting user; whoever was acted on is in properties (targetUserId, keyId, ...). */
  userId?: string | null
  userEmail?: string | null
  clientIp?: string | null
  resource?: string | null
  properties: Record<string, unknown>
}

export type ImportLogStatus = 'Succeeded' | 'PartiallySucceeded' | 'Duplicate' | 'Failed'

export interface ImportLog {
  id: string
  organizationId: string
  keyId?: string | null
  /** Resolved at read time, so it follows later edits of the key's description. */
  keyDescription?: string | null
  fileMd5: string
  status: ImportLogStatus
  requestedByUserId: string
  requestedByEmail?: string | null
  requestedByName?: string | null
  requestedAt: string
  completedAt?: string | null
  dataRangeStart?: string | null
  dataRangeEnd?: string | null
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

export interface ImportLogServiceSummary {
  serviceId: string
  totalCount: number
  succeededCount: number
  duplicateCount: number
  failedCount: number
  failedReason?: string | null
}

export interface ImportLogDetail extends ImportLog {
  failedLineSamples: ImportLogLineError[]
  serviceSummaries: ImportLogServiceSummary[]
}