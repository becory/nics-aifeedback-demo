import type {CreateOrganizationRequest, DataResponse, Organization, UpdateOrganizationRequest } from "../types";
import { instance } from "./api";

export const getOrganizations = (filter?: {IsActive?: boolean, currentUser?: boolean}) => instance.get<DataResponse<Organization[]>>('/organizations', { params: filter })

export const getOrganizationById = (id: string) => instance.get<Organization>(`/organizations/${id}`)

export const createOrganization = (organization: CreateOrganizationRequest) => instance.post<Organization>('/organizations', organization)

export const updateOrganization = (id: string, organization: UpdateOrganizationRequest) => instance.put<Organization>(`/organizations/${id}`, organization)

export const deleteOrganization = (id: string) => instance.delete<null>(`/organizations/${id}`)

export const restoreOrganization = (id: string) => instance.post<Organization>(`/organizations/${id}/restore`)