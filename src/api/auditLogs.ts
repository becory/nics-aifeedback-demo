import type { AuditLogEntry, DataResponse } from '../types';
import { instance, serializeRepeatedParams } from './api';

// Multi-value fields: repeat to OR (eventType=auth.*&eventType=user.*), prefix "-" to exclude
// (eventType=-auditLogs.queried). eventType also accepts a trailing ".*" for a whole domain.
export interface GetAuditLogsParams {
  eventType?: string[]
  userId?: string[]
  userEmail?: string[]
  targetUserId?: string[]
  organizationId?: string[]
  resource?: string[]
  clientIp?: string[]
  minSeverity?: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
  /** ISO timestamp; the backend defaults to 7 days ago when omitted. */
  from?: string
  to?: string
  pageSize?: number
  pageToken?: string
}

export const getAuditLogs = (params: GetAuditLogsParams) =>
  instance.get<DataResponse<AuditLogEntry[]>>('/audit-logs', {
    params,
    paramsSerializer: serializeRepeatedParams,
  })
