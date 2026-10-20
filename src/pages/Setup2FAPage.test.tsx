import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosResponse } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Setup2FAPage } from './Setup2FAPage'
import { useAuth } from '../lib/auth'
import { postEnable2FA } from '../api/auth'
import type { Enable2FAResponse, User } from '../types'

vi.mock('../lib/auth', () => ({ useAuth: vi.fn() }))
vi.mock('../api/auth', () => ({ postEnable2FA: vi.fn() }))

const mockedUseAuth = vi.mocked(useAuth)
const mockedEnable = vi.mocked(postEnable2FA)
type AuthValue = ReturnType<typeof useAuth>

const pending = { pendingToken: 'pending-1', requiresTwoFactorSetup: true }
const baseUser: User = { id: 'u1', name: 'Alice', email: 'a@example.com', organizationIds: [], isSystemAdmin: false }
const QR_URI = 'otpauth://totp/AIFeedback:alice?secret=ABC&issuer=AIFeedback'

const httpError = (status: number, data?: unknown) =>
  new AxiosError('failed', 'ERR', undefined, undefined, { status, data } as AxiosResponse)

function setAuth(overrides: Partial<AuthValue> = {}): AuthValue {
  const value: AuthValue = {
    ready: true,
    session: pending,
    user: null,
    notice: null,
    login: vi.fn(),
    verify2FA: vi.fn(),
    setup2FA: vi.fn().mockResolvedValue(null),
    logout: vi.fn(),
    ...overrides,
  }
  mockedUseAuth.mockReturnValue(value)
  return value
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/2fa/setup']}>
      <Routes>
        <Route path="/2fa/setup" element={<Setup2FAPage />} />
        <Route path="/login" element={<div>page:login</div>} />
        <Route path="/organizations" element={<div>page:organizations</div>} />
        <Route path="/my-services" element={<div>page:my-services</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockedUseAuth.mockReset()
  mockedEnable.mockReset()
  mockedEnable.mockResolvedValue({ data: { qrCodeUri: QR_URI } } as AxiosResponse<Enable2FAResponse>)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Setup2FAPage', () => {
  it('requests the 2FA secret with the pending token and shows a QR code', async () => {
    setAuth()
    const { container } = renderPage()
    expect(mockedEnable).toHaveBeenCalledWith('pending-1')
    await waitFor(() => expect(container.querySelector('svg')).toBeInTheDocument())
  })

  it('shows the locked message when the account is locked (423)', async () => {
    mockedEnable.mockRejectedValue(httpError(423))
    setAuth()
    renderPage()
    expect(await screen.findByText('帳號因連續驗證失敗已被鎖定，請 15 分鐘後再試')).toBeInTheDocument()
  })

  it('shows the server message when the QR code cannot be generated', async () => {
    mockedEnable.mockRejectedValue(httpError(400, { message: 'pending token 已失效' }))
    setAuth()
    renderPage()
    expect(await screen.findByText('無法產生二階段驗證 QR Code：pending token 已失效')).toBeInTheDocument()
  })

  it('shows a generic message when the failure carries no detail', async () => {
    mockedEnable.mockRejectedValue(new Error('network down'))
    setAuth()
    renderPage()
    expect(await screen.findByText('無法產生二階段驗證 QR Code')).toBeInTheDocument()
  })

  it('sends the typed code (digits only) to setup2FA', async () => {
    const auth = setAuth()
    renderPage()
    const user = userEvent.setup()
    const button = screen.getByRole('button', { name: '完成綁定' })
    await user.type(screen.getByLabelText('驗證碼'), '12x345')
    expect(button).toBeDisabled()
    await user.type(screen.getByLabelText('驗證碼'), '6')
    await user.click(button)
    expect(auth.setup2FA).toHaveBeenCalledWith('123456')
  })

  it('shows the error returned by setup2FA', async () => {
    setAuth({ setup2FA: vi.fn().mockResolvedValue('驗證碼錯誤') })
    renderPage()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('驗證碼'), '000000')
    await user.click(screen.getByRole('button', { name: '完成綁定' }))
    expect(await screen.findByText('驗證碼錯誤')).toBeInTheDocument()
  })

  it('shows progress while binding', async () => {
    let resolve!: (v: string | null) => void
    setAuth({ setup2FA: vi.fn(() => new Promise<string | null>((r) => (resolve = r))) })
    renderPage()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('驗證碼'), '123456')
    await user.click(screen.getByRole('button', { name: '完成綁定' }))
    expect(screen.getByRole('button', { name: '驗證中...' })).toBeDisabled()
    resolve(null)
    expect(await screen.findByRole('button', { name: '完成綁定' })).toBeEnabled()
  })

  it('sends a visitor without a pending login to the login page, without requesting a secret', () => {
    setAuth({ session: null })
    renderPage()
    expect(screen.getByText('page:login')).toBeInTheDocument()
    expect(mockedEnable).not.toHaveBeenCalled()
  })

  it('sends a signed-in user to their home', () => {
    setAuth({ session: { accessToken: 'tok' }, user: baseUser })
    renderPage()
    expect(screen.getByText('page:my-services')).toBeInTheDocument()
  })

  it('sends a signed-in system admin to the admin home', () => {
    setAuth({ session: { accessToken: 'tok' }, user: { ...baseUser, isSystemAdmin: true } })
    renderPage()
    expect(screen.getByText('page:organizations')).toBeInTheDocument()
  })
})
