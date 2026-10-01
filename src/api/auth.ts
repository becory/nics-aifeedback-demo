import {instance} from './api';
import type {Enable2FAResponse, LoginResponse, TwoFactorAuthResponse} from '../types';

export const postLogin = (userName: string, password: string) => instance.post<LoginResponse>('/auth/login', {
  "email": userName,
  "password": password
})

export const postEnable2FA = (pendingToken: string) => instance.post<Enable2FAResponse>('/auth/2fa/enable', { "pendingToken": pendingToken });

export const postConfirm2FA = (pendingToken: string, code: string) => instance.post<TwoFactorAuthResponse>('/auth/2fa/confirm', { "pendingToken": pendingToken, "code": code });

export const post2FA = (pendingToken: string, code: string) => instance.post<TwoFactorAuthResponse>('/auth/login/2fa', { "pendingToken": pendingToken, "code": code });

export const getUserInfo = () => instance.get('/auth/me')

// Longer than the 5s default: the server rotates the refresh token, so a client-side timeout on a
// slow (cold-start) response would drop the new cookie while the old one is already revoked.
export const postRefresh = () =>
  instance.post<TwoFactorAuthResponse>('/auth/refresh', {}, { withCredentials: true, timeout: 30000 })

export const postLogout = () => instance.post<null>('/auth/logout')

export const postChangePassword = (currentPassword: string, newPassword: string) => instance.post<null>('/auth/change-password', {
  "currentPassword": currentPassword,
  "newPassword": newPassword
})

export const postResetTwoFactor = (currentPassword: string) => instance.post<null>('/auth/2fa/reset', {
  "currentPassword": currentPassword
})