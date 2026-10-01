import type {
  CreatedOrganizationKey,
  CreateOrganizationKeyRequest,
  DataResponse,
  OrganizationKey,
  UpdateOrganizationKeyRequest,
} from '../types';
import { instance } from './api';

const keysPath = (organizationId: string) => `/organizations/${organizationId}/keys`

export const getOrganizationKeys = (organizationId: string) =>
  instance.get<DataResponse<OrganizationKey[]>>(keysPath(organizationId))

export const createOrganizationKey = (organizationId: string, key: CreateOrganizationKeyRequest) =>
  instance.post<CreatedOrganizationKey>(keysPath(organizationId), key)

export const updateOrganizationKey = (organizationId: string, keyId: string, key: UpdateOrganizationKeyRequest) =>
  instance.put<OrganizationKey>(`${keysPath(organizationId)}/${keyId}`, key)

export const revokeOrganizationKey = (organizationId: string, keyId: string) =>
  instance.post<OrganizationKey>(`${keysPath(organizationId)}/${keyId}/revoke`)

// POST because the response carries the full key; the services are picked per download and not stored.
export const generateOrganizationKeyEnv = (organizationId: string, keyId: string, serviceIds: string[]) =>
  instance.post<Blob>(`${keysPath(organizationId)}/${keyId}/env`, { serviceIds }, { responseType: 'blob' })
