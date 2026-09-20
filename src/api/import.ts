import type { DataResponse, ImportLog, ImportLogDetail } from '../types';
import { instance } from './api';

// The request body is whatever JSON the Agent CLI's export file contains (snake_case field
// names) — the frontend passes it straight through without re-shaping it.
// Decrypt + CSV parse + BigQuery dedup/insert can easily exceed the global 5s default (see
// api.ts), so this call gets its own generous timeout instead of raising the default for
// every request.
export const importOrganizationData = (organizationId: string, envelope: unknown) =>
  instance.post<ImportLogDetail>(`/organizations/${organizationId}/import`, envelope, {
    timeout: 120000,
  })

export interface GetImportLogsParams {
  organizationId?: string
}

export const getImportLogs = (params?: GetImportLogsParams) =>
  instance.get<DataResponse<ImportLog[]>>('/import-logs', { params })

export const getImportLogById = (id: string) => instance.get<ImportLogDetail>(`/import-logs/${id}`)
