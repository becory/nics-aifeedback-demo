import { act, renderHook, waitFor } from '@testing-library/react'
import { AxiosError, type AxiosResponse } from 'axios'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './auth'
import * as authApi from '../api/auth'
import * as api from '../api/api'
import { useIdleLogout } from './idleLogout'

vi.mock('../api/auth', () => ({
  getUserInfo: vi.fn(),
  post2FA: vi.fn(),
  postConfirm2FA: vi.fn(),
  postLogin: vi.fn(),
  postLogout: vi.fn(),
  postRefresh: vi.fn(),
}))

vi.mock('../api/api', () => ({
  refreshNow: vi.fn(() => Promise.resolve()),
  setAccessToken: vi.fn(),
  setOnUnauthorized: vi.fn(),
  setRefreshHandler: vi.fn(),
}))

vi.mock('./idleLogout', () => ({ useIdleLogout: vi.fn() }))

const mocked = vi.mocked(authApi)
const mockedApi = vi.mocked(api)
const mockedIdle = vi.mocked(useIdleLogout)

const user = { id: 'u1', name: 'Alice', email: 'a@example.com', organizationIds: [], isSystemAdmin: false }
const ok = <T,>(data: T) => ({ data }) as AxiosResponse<T>
const httpError = (status: number) =>
  new AxiosError('failed', 'ERR', undefined, undefined, { status } as AxiosResponse)

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>

/** Renders the provider and waits until the initial session refresh has settled. */
async function renderAuth() {
  const view = renderHook(() => useAuth(), { wrapper })
  await waitFor(() => expect(view.result.current.ready).toBe(true))
  return view
}

/** Logs in with a pending token so the 2FA steps can run. */
async function loginPending(setup: boolean) {
  mocked.postLogin.mockResolvedValue(
    ok({ requiresTwoFactorSetup: setup, requiresTwoFactor: !setup, pendingToken: 'pending-1' }),
  )
  const view = await renderAuth()
  await act(async () => {
    await view.result.current.login('alice', 'pw')
  })
  return view
}

beforeEach(() => {
  // Reset implementations too, so no test silently depends on a mock set up by an earlier one.
  vi.resetAllMocks()
  mockedApi.refreshNow.mockResolvedValue()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocked.postRefresh.mockRejectedValue(httpError(401))
  mocked.postLogout.mockResolvedValue(ok(null))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within AuthProvider')
  })
})

describe('initial load', () => {
  it('stays logged out and becomes ready when the session refresh fails', async () => {
    const { result } = await renderAuth()
    expect(result.current.session).toBeNull()
    expect(result.current.user).toBeNull()
    expect(mocked.getUserInfo).not.toHaveBeenCalled()
  })

  it('restores the session and user when the refresh succeeds', async () => {
    mocked.postRefresh.mockResolvedValue(ok({ accessToken: 'tok', expiresIn: 900 }))
    mocked.getUserInfo.mockResolvedValue(ok(user))
    const { result } = await renderAuth()
    await waitFor(() => expect(result.current.user).toEqual(user))
    expect(result.current.session).toEqual({
      requiresTwoFactorSetup: false,
      requiresTwoFactor: false,
      accessToken: 'tok',
    })
    expect(mockedApi.setAccessToken).toHaveBeenCalledWith('tok', 900)
  })

  it('stays logged out and clears the token when the refresh succeeds but loading the user fails', async () => {
    mocked.postRefresh.mockResolvedValue(ok({ accessToken: 'tok', expiresIn: 900 }))
    mocked.getUserInfo.mockRejectedValue(httpError(500))
    const { result } = await renderAuth()
    expect(result.current.session).toBeNull()
    expect(result.current.user).toBeNull()
    expect(mockedApi.setAccessToken).toHaveBeenLastCalledWith(null)
  })
})

describe('login', () => {
  it('returns step 2fa_setup when the account still needs to set up 2FA', async () => {
    mocked.postLogin.mockResolvedValue(ok({ requiresTwoFactorSetup: true, requiresTwoFactor: false, pendingToken: 'p' }))
    const { result } = await renderAuth()
    let outcome: Awaited<ReturnType<typeof result.current.login>> | undefined
    await act(async () => {
      outcome = await result.current.login('alice', 'pw')
    })
    expect(outcome).toEqual({ step: '2fa_setup' })
    expect(mocked.postLogin).toHaveBeenCalledWith('alice', 'pw')
    expect(result.current.session).toEqual({ requiresTwoFactorSetup: true, requiresTwoFactor: false, pendingToken: 'p' })
  })

  it('returns step 2fa_verify when 2FA is already set up', async () => {
    mocked.postLogin.mockResolvedValue(ok({ requiresTwoFactorSetup: false, requiresTwoFactor: true, pendingToken: 'p' }))
    const { result } = await renderAuth()
    let outcome: Awaited<ReturnType<typeof result.current.login>> | undefined
    await act(async () => {
      outcome = await result.current.login('alice', 'pw')
    })
    expect(outcome).toEqual({ step: '2fa_verify' })
  })

  it.each([
    ['a wrong password (HTTP error)', httpError(401), '帳號或密碼錯誤'],
    ['a locked account (423)', httpError(423), '帳號因連續驗證失敗已被鎖定，請 15 分鐘後再試'],
    ['a non-HTTP error', new Error('boom'), '登入時發生未知錯誤'],
  ])('maps %s to its message', async (_name, error, message) => {
    mocked.postLogin.mockRejectedValue(error)
    const { result } = await renderAuth()
    let outcome: Awaited<ReturnType<typeof result.current.login>> | undefined
    await act(async () => {
      outcome = await result.current.login('alice', 'bad')
    })
    expect(outcome).toEqual({ error: message })
    expect(result.current.session).toBeNull()
  })

  it('clears a previous notice when logging in again', async () => {
    const { result } = await renderAuth()
    act(() => result.current.logout('閒置超過 30 分鐘，系統已自動登出'))
    expect(result.current.notice).toBe('閒置超過 30 分鐘，系統已自動登出')
    mocked.postLogin.mockRejectedValue(httpError(401))
    await act(async () => {
      await result.current.login('alice', 'pw')
    })
    expect(result.current.notice).toBeNull()
  })
})

describe('verify2FA', () => {
  it('asks to log in first when there is no pending token', async () => {
    const { result } = await renderAuth()
    let message: string | null = ''
    await act(async () => {
      message = await result.current.verify2FA('123456')
    })
    expect(message).toBe('請先登入')
    expect(mocked.post2FA).not.toHaveBeenCalled()
  })

  it('refuses when the account still needs 2FA setup', async () => {
    const { result } = await loginPending(true)
    let message: string | null = ''
    await act(async () => {
      message = await result.current.verify2FA('123456')
    })
    expect(message).toBe('二階段驗證尚未設定')
    expect(mocked.post2FA).not.toHaveBeenCalled()
  })

  it('signs in with the pending token and loads the user on success', async () => {
    const { result } = await loginPending(false)
    mocked.post2FA.mockResolvedValue(ok({ accessToken: 'tok', expiresIn: 900 }))
    mocked.getUserInfo.mockResolvedValue(ok(user))
    let message: string | null = 'unset'
    await act(async () => {
      message = await result.current.verify2FA('123456')
    })
    expect(message).toBeNull()
    expect(mocked.post2FA).toHaveBeenCalledWith('pending-1', '123456')
    expect(mockedApi.setAccessToken).toHaveBeenCalledWith('tok', 900)
    expect(result.current.session?.accessToken).toBe('tok')
    expect(result.current.user).toEqual(user)
  })

  it.each([
    ['a wrong code', httpError(400), '驗證碼錯誤'],
    ['a locked account (423)', httpError(423), '帳號因連續驗證失敗已被鎖定，請 15 分鐘後再試'],
    ['a non-HTTP error', new Error('boom'), '驗證時發生未知錯誤'],
  ])('maps %s to its message and clears the token', async (_name, error, expected) => {
    const { result } = await loginPending(false)
    mocked.post2FA.mockRejectedValue(error)
    let message: string | null = null
    await act(async () => {
      message = await result.current.verify2FA('000000')
    })
    expect(message).toBe(expected)
    expect(mockedApi.setAccessToken).toHaveBeenLastCalledWith(null)
    expect(result.current.session?.accessToken).toBeUndefined()
    expect(result.current.user).toBeNull()
  })
})

describe('setup2FA', () => {
  it('asks to log in first when there is no pending token', async () => {
    const { result } = await renderAuth()
    let message: string | null = ''
    await act(async () => {
      message = await result.current.setup2FA('123456')
    })
    expect(message).toBe('請先登入')
    expect(mocked.postConfirm2FA).not.toHaveBeenCalled()
  })

  it('confirms with the pending token and loads the user on success', async () => {
    const { result } = await loginPending(true)
    mocked.postConfirm2FA.mockResolvedValue(ok({ accessToken: 'tok', expiresIn: 900 }))
    mocked.getUserInfo.mockResolvedValue(ok(user))
    let message: string | null = 'unset'
    await act(async () => {
      message = await result.current.setup2FA('123456')
    })
    expect(message).toBeNull()
    expect(mocked.postConfirm2FA).toHaveBeenCalledWith('pending-1', '123456')
    expect(result.current.session?.accessToken).toBe('tok')
    expect(result.current.user).toEqual(user)
  })

  it.each([
    ['a wrong code', httpError(400), '驗證碼錯誤，請確認已掃描 QR Code'],
    ['a locked account (423)', httpError(423), '帳號因連續驗證失敗已被鎖定，請 15 分鐘後再試'],
    ['a non-HTTP error', new Error('boom'), '綁定時發生未知錯誤'],
  ])('maps %s to its message', async (_name, error, expected) => {
    const { result } = await loginPending(true)
    mocked.postConfirm2FA.mockRejectedValue(error)
    let message: string | null = null
    await act(async () => {
      message = await result.current.setup2FA('000000')
    })
    expect(message).toBe(expected)
    expect(mockedApi.setAccessToken).toHaveBeenLastCalledWith(null)
    expect(result.current.user).toBeNull()
  })
})

/** Signs in fully through login + verify2FA. */
async function signIn() {
  const view = await loginPending(false)
  mocked.post2FA.mockResolvedValue(ok({ accessToken: 'tok', expiresIn: 900 }))
  mocked.getUserInfo.mockResolvedValue(ok(user))
  await act(async () => {
    await view.result.current.verify2FA('123456')
  })
  return view
}

describe('logout', () => {
  it('calls the API, clears the session and sets the given notice', async () => {
    const { result } = await signIn()
    act(() => result.current.logout('密碼已變更，請重新登入'))
    expect(mocked.postLogout).toHaveBeenCalledTimes(1)
    expect(result.current.session).toBeNull()
    expect(result.current.user).toBeNull()
    expect(result.current.notice).toBe('密碼已變更，請重新登入')
  })

  it('has no notice when none is given, and ignores a failing logout request', async () => {
    mocked.postLogout.mockRejectedValue(httpError(500))
    const { result } = await signIn()
    act(() => result.current.logout())
    expect(result.current.session).toBeNull()
    expect(result.current.notice).toBeNull()
  })
})

describe('idle logout', () => {
  it('is enabled only while signed in, and logs out with the idle notice', async () => {
    const { result } = await loginPending(false)
    expect(mockedIdle).toHaveBeenLastCalledWith(false, expect.any(Function), mockedApi.refreshNow)
    mocked.post2FA.mockResolvedValue(ok({ accessToken: 'tok', expiresIn: 900 }))
    mocked.getUserInfo.mockResolvedValue(ok(user))
    await act(async () => {
      await result.current.verify2FA('123456')
    })
    const [enabled, onIdle] = mockedIdle.mock.lastCall!
    expect(enabled).toBe(true)
    act(() => onIdle())
    expect(result.current.session).toBeNull()
    expect(result.current.notice).toBe('閒置超過 30 分鐘，系統已自動登出')
  })
})

describe('unauthorized handler', () => {
  const unauthorizedHandler = () => mockedApi.setOnUnauthorized.mock.calls.findLast(([fn]) => fn !== null)![0]!

  const refreshHandler = () => mockedApi.setRefreshHandler.mock.calls.findLast(([fn]) => fn !== null)![0]!

  it('registers a refresh handler that renews the token and reloads the user', async () => {
    const { result } = await renderAuth()
    mocked.postRefresh.mockResolvedValue(ok({ accessToken: 'tok', expiresIn: 900 }))
    mocked.getUserInfo.mockResolvedValue(ok(user))

    await act(() => refreshHandler()())

    expect(mockedApi.setAccessToken).toHaveBeenCalledWith('tok', 900)
    expect(result.current.session).toEqual({ requiresTwoFactorSetup: false, requiresTwoFactor: false, accessToken: 'tok' })
    expect(result.current.user).toEqual(user)
  })

  it('keeps the rest of an existing session when the refresh handler renews the token', async () => {
    const { result } = await signIn()
    const before = result.current.session!
    mocked.postRefresh.mockResolvedValue(ok({ accessToken: 'tok-2', expiresIn: 900 }))

    await act(() => refreshHandler()())

    expect(result.current.session).toEqual({ ...before, accessToken: 'tok-2' })
    expect(result.current.user).toEqual(user)
  })

  it('signs out with the timed-out notice when a signed-in session gets a 401', async () => {
    const { result } = await signIn()
    act(() => unauthorizedHandler()())
    expect(result.current.session).toBeNull()
    expect(result.current.user).toBeNull()
    expect(result.current.notice).toBe('登入已逾時，系統已自動登出，請重新登入')
  })

  it('keeps the logout notice when a late 401 arrives after an explicit logout', async () => {
    const { result } = await signIn()
    act(() => result.current.logout('密碼已變更，請重新登入'))
    act(() => unauthorizedHandler()())
    expect(result.current.notice).toBe('密碼已變更，請重新登入')
  })

  it('unregisters its handlers on unmount', async () => {
    const { unmount } = await renderAuth()
    unmount()
    expect(mockedApi.setRefreshHandler).toHaveBeenLastCalledWith(null)
    expect(mockedApi.setOnUnauthorized).toHaveBeenLastCalledWith(null)
  })
})
