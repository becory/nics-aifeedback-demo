import type { CreateOfflineKeyRequest, DataResponse, OfflineKey, UpdateOfflineKeyRequest } from '../types';
import { instance } from './api';

export const getOfflineKeys = (orgId?: string) => instance.get<DataResponse<OfflineKey[]>>('/offline-keys', { params: { orgId } })

export const getOfflineKeyById = (id: string) => instance.get<OfflineKey>(`/offline-keys/${id}`)

export const createOfflineKey = (offlineKey: CreateOfflineKeyRequest) => instance.post<OfflineKey>('/offline-keys', offlineKey)

export const updateOfflineKey = (id: string, offlineKey: UpdateOfflineKeyRequest) => instance.put<OfflineKey>(`/offline-keys/${id}`, offlineKey)

export const deleteOfflineKey = (id: string) => instance.delete<null>(`/offline-keys/${id}`)
