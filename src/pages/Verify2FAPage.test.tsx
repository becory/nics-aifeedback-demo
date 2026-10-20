import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Verify2FAPage } from './Verify2FAPage'
import { useAuth } from '../lib/auth'
import type { User } from '../types'

vi.mock('../lib/auth', () => ({ useAuth: vi.fn() }))

const mockedUseAuth = vi.mocked(useAuth)
type AuthValue = ReturnType<typeof useAuth>

const pending = { pendingToken: 'p', requiresTwoFactor: true }
const baseUser: User = { id: 'u1', name: 'Alice', email: 'a@example.com', organizationIds: [], isSystemAdmin: false }

function setAuth(overrides: Partial<AuthValue> = {}): AuthValue {
  const value: AuthValue = {
    ready: true,
    session: pending,
    user: null,
    notice: null,
    login: vi.fn(),
    verify2FA: vi.fn().mockResolvedValue(null),
    setup2FA: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  }
  mockedUseAuth.mockReturnValue(value)
  return value
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/2fa/verify']}>
      <Routes>
        <Route path="/2fa/verify" element={<Verify2FAPage />} />
        <Route path="/organizations" element={<div>page:organizations</div>} />
        <Route path="/my-services" element={<div>page:my-services</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockedUseAuth.mockReset()
})

describe('Verify2FAPage', () => {
  it('keeps only digits and enables 驗證 once six are entered', async () => {
    setAuth()
    renderPage()
    const user = userEvent.setup()
    const input = screen.getByLabelText('驗證碼')
    const button = screen.getByRole('button', { name: '驗證' })
    await user.type(input, '12a3-45')
    expect(input).toHaveValue('12345')
    expect(button).toBeDisabled()
    await user.type(input, '6')
    expect(input).toHaveValue('123456')
    expect(button).toBeEnabled()
  })

  it('sends the code to verify2FA', async () => {
    const auth = setAuth()
    renderPage()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('驗證碼'), '654321')
    await user.click(screen.getByRole('button', { name: '驗證' }))
    expect(auth.verify2FA).toHaveBeenCalledWith('654321')
  })

  it('submits with Enter', async () => {
    const auth = setAuth()
    renderPage()
    await userEvent.setup().type(screen.getByLabelText('驗證碼'), '111222{Enter}')
    expect(auth.verify2FA).toHaveBeenCalledWith('111222')
  })

  it('shows the error returned by verify2FA', async () => {
    setAuth({ verify2FA: vi.fn().mockResolvedValue('驗證碼錯誤') })
    renderPage()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('驗證碼'), '000000')
    await user.click(screen.getByRole('button', { name: '驗證' }))
    expect(await screen.findByText('驗證碼錯誤')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '驗證' })).toBeEnabled()
  })

  it('shows progress while verifying', async () => {
    let resolve!: (v: string | null) => void
    setAuth({ verify2FA: vi.fn(() => new Promise<string | null>((r) => (resolve = r))) })
    renderPage()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('驗證碼'), '123456')
    await user.click(screen.getByRole('button', { name: '驗證' }))
    expect(screen.getByRole('button', { name: '驗證中...' })).toBeDisabled()
    resolve('驗證碼錯誤')
    expect(await screen.findByText('驗證碼錯誤')).toBeInTheDocument()
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
