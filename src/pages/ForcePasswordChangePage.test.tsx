import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ForcePasswordChangePage } from './ForcePasswordChangePage'
import { useAuth } from '../lib/auth'
import { postChangePassword } from '../api/auth'
import { PASSWORD_RULE_HINT } from '../lib/passwordRules'

vi.mock('../lib/auth', () => ({ useAuth: vi.fn() }))
vi.mock('../api/auth', () => ({ postChangePassword: vi.fn() }))

const mockedUseAuth = vi.mocked(useAuth)
const mockedChange = vi.mocked(postChangePassword)
type AuthValue = ReturnType<typeof useAuth>

const httpError = (status: number, data?: unknown) =>
  new AxiosError('failed', 'ERR', undefined, undefined, { status, data } as AxiosResponse)

function setAuth(): AuthValue {
  const value: AuthValue = {
    ready: true,
    session: { accessToken: 'tok' },
    user: { id: 'u1', name: 'Alice', email: 'a@example.com', organizationIds: [], isSystemAdmin: false, mustChangePassword: true },
    notice: null,
    login: vi.fn(),
    verify2FA: vi.fn(),
    setup2FA: vi.fn(),
    logout: vi.fn(),
  }
  mockedUseAuth.mockReturnValue(value)
  return value
}

async function fill(current: string, next: string, confirm: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('目前密碼'), current)
  await user.type(screen.getByLabelText('新密碼'), next)
  await user.type(screen.getByLabelText('確認新密碼'), confirm)
  await user.click(screen.getByRole('button', { name: '更新密碼' }))
}

beforeEach(() => {
  mockedUseAuth.mockReset()
  mockedChange.mockReset()
})

describe('ForcePasswordChangePage', () => {
  it('shows the password rule under the new password', () => {
    setAuth()
    render(<ForcePasswordChangePage />)
    expect(screen.getByText(PASSWORD_RULE_HINT)).toBeInTheDocument()
  })

  it('rejects a confirmation that does not match, without calling the API', async () => {
    const auth = setAuth()
    render(<ForcePasswordChangePage />)
    await fill('Old-Passw0rd!', 'New-Passw0rd!x', 'New-Passw0rd!y')
    expect(screen.getByText('新密碼與確認密碼不一致')).toBeInTheDocument()
    expect(mockedChange).not.toHaveBeenCalled()
    expect(auth.logout).not.toHaveBeenCalled()
  })

  it('changes the password, then logs out with a notice to sign in again', async () => {
    mockedChange.mockResolvedValue({ data: null } as AxiosResponse<null>)
    const auth = setAuth()
    render(<ForcePasswordChangePage />)
    await fill('Old-Passw0rd!', 'New-Passw0rd!x', 'New-Passw0rd!x')
    expect(mockedChange).toHaveBeenCalledWith('Old-Passw0rd!', 'New-Passw0rd!x')
    expect(auth.logout).toHaveBeenCalledWith('密碼已更新，請以新密碼重新登入')
  })

  it('shows the server error and stays signed in', async () => {
    mockedChange.mockRejectedValue(httpError(400, { message: '密碼不符合規則', errors: ['至少 12 個字元'] }))
    const auth = setAuth()
    render(<ForcePasswordChangePage />)
    await fill('Old-Passw0rd!', 'short', 'short')
    expect(await screen.findByText('密碼不符合規則 至少 12 個字元')).toBeInTheDocument()
    expect(auth.logout).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '更新密碼' })).toBeEnabled()
  })

  it('shows a generic error when the server gives no message', async () => {
    mockedChange.mockRejectedValue(new Error('network down'))
    setAuth()
    render(<ForcePasswordChangePage />)
    await fill('Old-Passw0rd!', 'New-Passw0rd!x', 'New-Passw0rd!x')
    expect(await screen.findByText('變更密碼時發生錯誤')).toBeInTheDocument()
  })

  it('shows progress while updating', async () => {
    mockedChange.mockReturnValue(new Promise(() => {}))
    setAuth()
    render(<ForcePasswordChangePage />)
    await fill('Old-Passw0rd!', 'New-Passw0rd!x', 'New-Passw0rd!x')
    expect(screen.getByRole('button', { name: '更新中...' })).toBeDisabled()
  })

  it('lets the user log out without changing the password', async () => {
    const auth = setAuth()
    render(<ForcePasswordChangePage />)
    await userEvent.setup().click(screen.getByRole('button', { name: '登出' }))
    expect(auth.logout).toHaveBeenCalledTimes(1)
    expect(auth.logout).toHaveBeenCalledWith()
    expect(mockedChange).not.toHaveBeenCalled()
  })
})
