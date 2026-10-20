import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosResponse } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SecuritySettingsPage } from './SecuritySettingsPage'
import { useAuth } from '../lib/auth'
import { postChangePassword, postResetTwoFactor } from '../api/auth'
import { PASSWORD_RULE_HINT } from '../lib/passwordRules'
import type { User } from '../types'

vi.mock('../lib/auth', () => ({ useAuth: vi.fn() }))
vi.mock('../api/auth', () => ({ postChangePassword: vi.fn(), postResetTwoFactor: vi.fn() }))

const mockedUseAuth = vi.mocked(useAuth)
const mockedChange = vi.mocked(postChangePassword)
const mockedReset = vi.mocked(postResetTwoFactor)
type AuthValue = ReturnType<typeof useAuth>

const alice: User = { id: 'u1', name: 'Alice', email: 'a@example.com', organizationIds: [], isSystemAdmin: false }
const httpError = (status: number, data?: unknown) =>
  new AxiosError('failed', 'ERR', undefined, undefined, { status, data } as AxiosResponse)

function setAuth(user: User | null = alice): AuthValue {
  const value: AuthValue = {
    ready: true,
    session: { accessToken: 'tok' },
    user,
    notice: null,
    login: vi.fn(),
    verify2FA: vi.fn(),
    setup2FA: vi.fn(),
    logout: vi.fn(),
  }
  mockedUseAuth.mockReturnValue(value)
  return value
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/security-settings']}>
      <Routes>
        <Route path="/security-settings" element={<SecuritySettingsPage />} />
        <Route path="/login" element={<div>page:login</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Each card is the heading's container; both cards have a field labelled 目前密碼. */
const card = (title: string) => within(screen.getByRole('heading', { name: title }).parentElement!)
const passwordCard = () => card('修改密碼')
const resetCard = () => card('重設二階段驗證')
/**
 * The reset card's own password field. Known bug (tracked separately): ui `Input` uses the label as
 * its id, so both 目前密碼 fields get id="目前密碼" and this field's label points at the other one.
 * Once fixed, query it with `resetCard().getByLabelText('目前密碼')` instead.
 */
const resetPasswordInput = () => resetCard().getByDisplayValue('', { exact: true }) as HTMLInputElement

async function changePassword(current: string, next: string, confirm: string) {
  const user = userEvent.setup()
  const c = passwordCard()
  if (current) await user.type(c.getByLabelText('目前密碼'), current)
  if (next) await user.type(c.getByLabelText('新密碼'), next)
  if (confirm) await user.type(c.getByLabelText('確認新密碼'), confirm)
  await user.click(c.getByRole('button', { name: '更新密碼' }))
}

async function resetTwoFactor(password: string) {
  const user = userEvent.setup()
  if (password) await user.type(resetPasswordInput(), password)
  await user.click(resetCard().getByRole('button', { name: '重設二階段驗證' }))
}

let confirmMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockedUseAuth.mockReset()
  mockedChange.mockReset()
  mockedReset.mockReset()
  confirmMock = vi.fn(() => true)
  vi.stubGlobal('confirm', confirmMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SecuritySettingsPage — change password', () => {
  it('shows the password rule under the new password', () => {
    setAuth()
    renderPage()
    expect(passwordCard().getByText(PASSWORD_RULE_HINT)).toBeInTheDocument()
  })

  it.each([
    ['the current password is missing', '', 'New-Passw0rd!x', 'New-Passw0rd!x', '請輸入目前密碼'],
    ['the new password is missing', 'Old-Passw0rd!', '', '', '請輸入新密碼'],
    ['the confirmation does not match', 'Old-Passw0rd!', 'New-Passw0rd!x', 'New-Passw0rd!y', '新密碼與確認密碼不一致'],
    ['the new password equals the current one', 'Same-Passw0rd!', 'Same-Passw0rd!', 'Same-Passw0rd!', '新密碼不可與目前密碼相同'],
  ])('rejects the form when %s, without calling the API', async (_case, current, next, confirm, message) => {
    const auth = setAuth()
    renderPage()
    await changePassword(current, next, confirm)
    expect(passwordCard().getByText(message)).toBeInTheDocument()
    expect(mockedChange).not.toHaveBeenCalled()
    expect(auth.logout).not.toHaveBeenCalled()
  })

  it('asks to sign in when there is no user', async () => {
    setAuth(null)
    renderPage()
    await changePassword('Old-Passw0rd!', 'New-Passw0rd!x', 'New-Passw0rd!x')
    expect(screen.getByText('請先登入')).toBeInTheDocument()
    expect(mockedChange).not.toHaveBeenCalled()
  })

  it('changes the password, logs out with a notice and goes to the login page', async () => {
    mockedChange.mockResolvedValue({ data: null } as AxiosResponse<null>)
    const auth = setAuth()
    renderPage()
    await changePassword('Old-Passw0rd!', 'New-Passw0rd!x', 'New-Passw0rd!x')
    expect(mockedChange).toHaveBeenCalledWith('Old-Passw0rd!', 'New-Passw0rd!x')
    expect(auth.logout).toHaveBeenCalledWith('密碼已更新，請以新密碼重新登入')
    expect(await screen.findByText('page:login')).toBeInTheDocument()
  })

  it('shows the server error and stays on the page', async () => {
    mockedChange.mockRejectedValue(httpError(400, { message: '目前密碼錯誤' }))
    const auth = setAuth()
    renderPage()
    await changePassword('Wrong-Passw0rd!', 'New-Passw0rd!x', 'New-Passw0rd!x')
    expect(await screen.findByText('更新密碼時發生錯誤：目前密碼錯誤')).toBeInTheDocument()
    expect(auth.logout).not.toHaveBeenCalled()
    expect(passwordCard().getByRole('button', { name: '更新密碼' })).toBeEnabled()
  })

  it('shows a generic error when the server gives no message', async () => {
    mockedChange.mockRejectedValue(new Error('network down'))
    setAuth()
    renderPage()
    await changePassword('Old-Passw0rd!', 'New-Passw0rd!x', 'New-Passw0rd!x')
    expect(await screen.findByText('更新密碼時發生錯誤')).toBeInTheDocument()
  })

  it('shows progress while updating', async () => {
    mockedChange.mockReturnValue(new Promise(() => {}))
    setAuth()
    renderPage()
    await changePassword('Old-Passw0rd!', 'New-Passw0rd!x', 'New-Passw0rd!x')
    expect(passwordCard().getByRole('button', { name: '更新中...' })).toBeDisabled()
  })
})

describe('SecuritySettingsPage — reset 2FA', () => {
  it('requires the current password, without asking for confirmation', async () => {
    setAuth()
    renderPage()
    await resetTwoFactor('')
    expect(resetCard().getByText('請輸入目前密碼')).toBeInTheDocument()
    expect(confirmMock).not.toHaveBeenCalled()
    expect(mockedReset).not.toHaveBeenCalled()
  })

  it('does nothing when the confirmation is cancelled', async () => {
    confirmMock.mockReturnValue(false)
    const auth = setAuth()
    renderPage()
    await resetTwoFactor('Cur-Passw0rd!')
    expect(confirmMock).toHaveBeenCalledTimes(1)
    expect(mockedReset).not.toHaveBeenCalled()
    expect(auth.logout).not.toHaveBeenCalled()
  })

  it('resets 2FA with the current password, logs out and goes to the login page', async () => {
    mockedReset.mockResolvedValue({ data: null } as AxiosResponse<null>)
    const auth = setAuth()
    renderPage()
    await resetTwoFactor('Cur-Passw0rd!')
    expect(confirmMock).toHaveBeenCalledWith(expect.stringContaining('確定要重設二階段驗證'))
    expect(mockedReset).toHaveBeenCalledWith('Cur-Passw0rd!')
    expect(auth.logout).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('page:login')).toBeInTheDocument()
  })

  it('does not send the change-password form fields to the reset', async () => {
    mockedReset.mockResolvedValue({ data: null } as AxiosResponse<null>)
    setAuth()
    renderPage()
    await userEvent.setup().type(passwordCard().getByLabelText('目前密碼'), 'Other-Passw0rd!')
    await resetTwoFactor('Cur-Passw0rd!')
    expect(mockedReset).toHaveBeenCalledWith('Cur-Passw0rd!')
  })

  it('shows the server error and stays signed in', async () => {
    mockedReset.mockRejectedValue(httpError(400, { message: '目前密碼錯誤' }))
    const auth = setAuth()
    renderPage()
    await resetTwoFactor('Wrong-Passw0rd!')
    expect(await screen.findByText('重設二階段驗證時發生錯誤：目前密碼錯誤')).toBeInTheDocument()
    expect(auth.logout).not.toHaveBeenCalled()
    expect(resetCard().getByRole('button', { name: '重設二階段驗證' })).toBeEnabled()
  })

  it('shows a generic error when the server gives no message', async () => {
    mockedReset.mockRejectedValue(new Error('network down'))
    setAuth()
    renderPage()
    await resetTwoFactor('Cur-Passw0rd!')
    expect(await screen.findByText('重設二階段驗證時發生錯誤')).toBeInTheDocument()
  })

  it('shows progress while resetting', async () => {
    mockedReset.mockReturnValue(new Promise(() => {}))
    setAuth()
    renderPage()
    await resetTwoFactor('Cur-Passw0rd!')
    expect(resetCard().getByRole('button', { name: '重設中...' })).toBeDisabled()
  })
})
