import type { CreateServiceRequest, DataResponse, Service, UpdateServiceRequest } from '../types';
import { instance } from './api';

export interface GetServicesParams {
  organizationId?: string
  code?: string
  isActive?: boolean
  keyword?: string
}

export const getServices = (params?: GetServicesParams) => instance.get<DataResponse<Service[]>>('/services', { params })

export const createService = (service: CreateServiceRequest) => instance.post<Service>('/services', service)

export const updateService = (id: string, service: UpdateServiceRequest) => instance.put<Service>(`/services/${id}`, service)

export const deleteService = (id: string) => instance.delete<null>(`/services/${id}`)

export const restoreService = (id: string) => instance.post<Service>(`/services/${id}/restore`)
