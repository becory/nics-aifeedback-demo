import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'
import { useAuth } from '../lib/auth'

vi.mock('../lib/auth', () => ({ useAuth: vi.fn() }))

const mockedUseAuth = vi.mocked(useAuth)
type AuthValue = ReturnType<typeof useAuth>

function setAuth(overrides: Partial<AuthValue> = {}): AuthValue {
  const value: AuthValue = {
    ready: true,
    session: null,
    user: null,
    notice: null,
    login: vi.fn(),
    verify2FA: vi.fn(),
    setup2FA: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  }
  mockedUseAuth.mockReturnValue(value)
  return value
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/2fa/setup" element={<div>page:2fa-setup</div>} />
        <Route path="/2fa/verify" element={<div>page:2fa-verify</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function submit(username: string, password: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('帳號'), username)
  await user.type(screen.getByLabelText('密碼'), password)
  await user.click(screen.getByRole('button', { name: '登入' }))
}

beforeEach(() => {
  mockedUseAuth.mockReset()
})

describe('LoginPage', () => {
  it('sends the typed username and password to login', async () => {
    const auth = setAuth({ login: vi.fn().mockResolvedValue({ step: '2fa_verify' }) })
    renderLogin()
    await submit('alice@example.com', 'S3cret!pass')
    expect(auth.login).toHaveBeenCalledTimes(1)
    expect(auth.login).toHaveBeenCalledWith('alice@example.com', 'S3cret!pass')
  })

  it('goes to the 2FA verify page when the account already has 2FA', async () => {
    setAuth({ login: vi.fn().mockResolvedValue({ step: '2fa_verify' }) })
    renderLogin()
    await submit('alice', 'pw')
    expect(await screen.findByText('page:2fa-verify')).toBeInTheDocument()
  })

  it('goes to the 2FA setup page when the account still has to bind 2FA', async () => {
    setAuth({ login: vi.fn().mockResolvedValue({ step: '2fa_setup' }) })
    renderLogin()
    await submit('alice', 'pw')
    expect(await screen.findByText('page:2fa-setup')).toBeInTheDocument()
  })

  it('shows the login error and stays on the page', async () => {
    setAuth({ login: vi.fn().mockResolvedValue({ error: '帳號或密碼錯誤' }) })
    renderLogin()
    await submit('alice', 'wrong')
    expect(await screen.findByText('帳號或密碼錯誤')).toBeInTheDocument()
    expect(screen.queryByText(/^page:/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '登入' })).toBeEnabled()
  })

  it('does not submit without a username and password', async () => {
    const auth = setAuth()
    renderLogin()
    await userEvent.setup().click(screen.getByRole('button', { name: '登入' }))
    expect(auth.login).not.toHaveBeenCalled()
  })

  it('shows the notice from auth (e.g. after a logout)', () => {
    setAuth({ notice: '登入已逾時，系統已自動登出，請重新登入' })
    renderLogin()
    expect(screen.getByText('登入已逾時，系統已自動登出，請重新登入')).toBeInTheDocument()
  })

  it('shows the error instead of the notice once a login attempt fails', async () => {
    setAuth({ notice: '密碼已更新，請以新密碼重新登入', login: vi.fn().mockResolvedValue({ error: '帳號或密碼錯誤' }) })
    renderLogin()
    await submit('alice', 'wrong')
    expect(await screen.findByText('帳號或密碼錯誤')).toBeInTheDocument()
    expect(screen.queryByText('密碼已更新，請以新密碼重新登入')).not.toBeInTheDocument()
  })

  it('disables the button and shows progress while logging in', async () => {
    let resolve!: (v: { step: '2fa_verify' }) => void
    setAuth({ login: vi.fn(() => new Promise<{ step: '2fa_verify' }>((r) => (resolve = r))) })
    renderLogin()
    await submit('alice', 'pw')
    expect(screen.getByRole('button', { name: '登入中...' })).toBeDisabled()
    resolve({ step: '2fa_verify' })
    expect(await screen.findByText('page:2fa-verify')).toBeInTheDocument()
  })
})
