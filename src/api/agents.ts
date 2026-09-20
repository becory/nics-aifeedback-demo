import type { Agent, CreateAgentRequest, DataResponse, UpdateAgentRequest } from '../types';
import { instance } from './api';

export interface GetAgentsParams {
  organizationId?: string
  isActive?: boolean
  serviceId?: string
  currentUser?: boolean
}

export const getAgents = (params?: GetAgentsParams) => instance.get<DataResponse<Agent[]>>('/agents', { params })

export const getAgentById = (id: string) => instance.get<Agent>(`/agents/${id}`)

export const createAgent = (agent: CreateAgentRequest) => instance.post<Agent>('/agents', agent)

export const updateAgent = (id: string, agent: UpdateAgentRequest) => instance.put<Agent>(`/agents/${id}`, agent)

export const deleteAgent = (id: string) => instance.delete<null>(`/agents/${id}`)

export const rotateAgentKey = (id: string, expiresAt: string) =>
  instance.post<Agent>(`/agents/${id}/rotate-key`, { expiresAt })

export const revokeAgentKey = (id: string, keyId: string) => instance.post<Agent>(`/agents/${id}/keys/${keyId}/revoke`)

export const downloadAgentEnv = (id: string) => instance.get<Blob>(`/agents/${id}/env`, { responseType: 'blob' })
