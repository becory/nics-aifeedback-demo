import type { CreateUser, DataResponse, User } from '../types';
import {instance} from './api';

export const getUsers = () => instance.get<DataResponse<User[]>>('/users')

export const getUserById = (userId: string) => instance.get<User>(`/users/${userId}`)

export const createUser = (user: CreateUser) => instance.post<User>('/users', user)

export const updateUser = (userId: string, user: Partial<User>) => instance.put<User>(`/users/${userId}`, user)

export const deleteUser = (userId: string) => instance.delete<null>(`/users/${userId}`)

export const changeUserPassword = (userId: string, newPassword: string) => instance.post<User>(`/users/${userId}/change-password`, { NewPassword: newPassword })

export const resetUser2FA = (userId: string) => instance.post<null>(`/users/${userId}/reset-2fa`)

export const grantUserOrgAccess = (userId: string, orgId: string) => instance.post<null>(`/users/${userId}/org-access-grants`, { orgId })

export const revokeUserOrgAccess = (userId: string, orgId: string) => instance.delete<null>(`/users/${userId}/org-access-grants/${orgId}`)