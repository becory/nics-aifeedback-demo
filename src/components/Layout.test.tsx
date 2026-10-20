import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Layout } from './Layout'
import { useAuth } from '../lib/auth'
import type { User } from '../types'

vi.mock('../lib/auth', () => ({ useAuth: vi.fn() }))

const mockedUseAuth = vi.mocked(useAuth)
type AuthValue = ReturnType<typeof useAuth>

const alice: User = { id: 'u1', name: 'Alice Chen', email: 'alice@example.com', organizationIds: [], isSystemAdmin: false }
const admin: User = { ...alice, name: 'Bob Admin', email: 'bob@example.com', isSystemAdmin: true }

const USER_LINKS = ['回饋資料總覽', '資料匯入', '服務清單']
const ADMIN_LINKS = ['服務管理', '使用者管理', '分數管理', '稽核日誌']

function setAuth(user: User | null): AuthValue {
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

function renderLayout(path = '/my-services') {
  const page = (name: string) => <div>page:{name}</div>
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/my-services" element={page('my-services')} />
          <Route path="/feedback-overview" element={page('feedback-overview')} />
          <Route path="/users" element={page('users')} />
          <Route path="/security-settings" element={page('security-settings')} />
        </Route>
        <Route path="/login" element={page('login')} />
      </Routes>
    </MemoryRouter>,
  )
}

const nav = () => within(screen.getByRole('navigation'))
const accountButton = () => screen.getByRole('button', { name: /Alice Chen|Bob Admin/ })
const menuButton = () => screen.getByRole('button', { name: /開啟選單|關閉選單/ })

beforeEach(() => {
  mockedUseAuth.mockReset()
})

describe('Layout navigation', () => {
  it('shows only the user section to a regular user', () => {
    setAuth(alice)
    renderLayout()
    for (const label of USER_LINKS) expect(nav().getByRole('link', { name: label })).toBeInTheDocument()
    for (const label of ADMIN_LINKS) expect(nav().queryByRole('link', { name: label })).not.toBeInTheDocument()
    expect(nav().queryByText('管理員功能')).not.toBeInTheDocument()
  })

  it('also shows the admin section to a system admin', () => {
    setAuth(admin)
    renderLayout()
    expect(nav().getByText('管理員功能')).toBeInTheDocument()
    for (const label of [...USER_LINKS, ...ADMIN_LINKS]) {
      expect(nav().getByRole('link', { name: label })).toBeInTheDocument()
    }
  })

  it('links each item to its route', () => {
    setAuth(admin)
    renderLayout()
    const expected: Record<string, string> = {
      回饋資料總覽: '/feedback-overview',
      資料匯入: '/import',
      服務清單: '/my-services',
      服務管理: '/services',
      使用者管理: '/users',
      分數管理: '/scores',
      稽核日誌: '/audit-logs',
    }
    for (const [label, href] of Object.entries(expected)) {
      expect(nav().getByRole('link', { name: label })).toHaveAttribute('href', href)
    }
  })

  it('marks the current page link', () => {
    setAuth(alice)
    renderLayout('/feedback-overview')
    expect(nav().getByRole('link', { name: '回饋資料總覽' })).toHaveAttribute('aria-current', 'page')
    expect(nav().getByRole('link', { name: '服務清單' })).not.toHaveAttribute('aria-current')
  })

  it('renders the routed page and navigates via the sidebar', async () => {
    setAuth(alice)
    renderLayout()
    expect(screen.getByText('page:my-services')).toBeInTheDocument()
    await userEvent.setup().click(nav().getByRole('link', { name: '回饋資料總覽' }))
    expect(screen.getByText('page:feedback-overview')).toBeInTheDocument()
  })
})

describe('Layout mobile drawer', () => {
  it('toggles the drawer with the menu button', async () => {
    setAuth(alice)
    renderLayout()
    const user = userEvent.setup()
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
    expect(menuButton()).toHaveAccessibleName('開啟選單')
    await user.click(menuButton())
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true')
    expect(menuButton()).toHaveAccessibleName('關閉選單')
    await user.click(menuButton())
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes the drawer with Escape', async () => {
    setAuth(alice)
    renderLayout()
    const user = userEvent.setup()
    await user.click(menuButton())
    await user.keyboard('{Escape}')
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes the drawer after navigating', async () => {
    setAuth(alice)
    renderLayout()
    const user = userEvent.setup()
    await user.click(menuButton())
    await user.click(nav().getByRole('link', { name: '回饋資料總覽' }))
    expect(screen.getByText('page:feedback-overview')).toBeInTheDocument()
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('Layout account menu', () => {
  it('shows the current user name, and email in the opened menu', async () => {
    setAuth(alice)
    renderLayout()
    expect(accountButton()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await userEvent.setup().click(accountButton())
    const menu = within(screen.getByRole('menu'))
    expect(menu.getByText('Alice Chen')).toBeInTheDocument()
    expect(menu.getByText('alice@example.com')).toBeInTheDocument()
    expect(menu.queryByText('管理員')).not.toBeInTheDocument()
    expect(accountButton()).toHaveAttribute('aria-expanded', 'true')
  })

  it('marks a system admin in the menu', async () => {
    setAuth(admin)
    renderLayout()
    await userEvent.setup().click(accountButton())
    expect(within(screen.getByRole('menu')).getByText('管理員')).toBeInTheDocument()
  })

  it('logs out and goes to the login page', async () => {
    const auth = setAuth(alice)
    renderLayout()
    const user = userEvent.setup()
    await user.click(accountButton())
    await user.click(screen.getByRole('menuitem', { name: '登出' }))
    expect(auth.logout).toHaveBeenCalledTimes(1)
    expect(screen.getByText('page:login')).toBeInTheDocument()
  })

  it('opens the security settings and closes the menu', async () => {
    setAuth(alice)
    renderLayout()
    const user = userEvent.setup()
    await user.click(accountButton())
    await user.click(screen.getByRole('menuitem', { name: '安全性設定' }))
    expect(screen.getByText('page:security-settings')).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes the menu with Escape', async () => {
    setAuth(alice)
    renderLayout()
    const user = userEvent.setup()
    await user.click(accountButton())
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes the menu on a click outside it, but not on a click inside it', async () => {
    setAuth(alice)
    renderLayout()
    const user = userEvent.setup()
    await user.click(accountButton())
    await user.click(screen.getByText('alice@example.com'))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await user.click(screen.getByText('page:my-services'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
