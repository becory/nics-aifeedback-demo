import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminRoute, GuestRoute, ProtectedRoute, TwoFactorRoute } from './ProtectedRoute'
import { useAuth } from '../lib/auth'
import type { Session, User } from '../types'

vi.mock('../lib/auth', () => ({ useAuth: vi.fn() }))

const mockedUseAuth = vi.mocked(useAuth)

const signedIn: Session = { accessToken: 'tok' }
const baseUser: User = { id: 'u1', name: 'Alice', email: 'a@example.com', organizationIds: [], isSystemAdmin: false }

function setAuth({ ready = true, session = null, user = null }: { ready?: boolean; session?: Session | null; user?: User | null }) {
  mockedUseAuth.mockReturnValue({
    ready,
    session,
    user,
    notice: null,
    login: vi.fn(),
    verify2FA: vi.fn(),
    setup2FA: vi.fn(),
    logout: vi.fn(),
  })
}

/** Every route renders its own name, so the visible text tells where navigation ended up. */
function renderAt(path: string) {
  const page = (name: string) => <div>page:{name}</div>
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={page('login')} />
        </Route>
        <Route element={<TwoFactorRoute mode="setup" />}>
          <Route path="/2fa/setup" element={page('2fa-setup')} />
        </Route>
        <Route element={<TwoFactorRoute mode="verify" />}>
          <Route path="/2fa/verify" element={page('2fa-verify')} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/my-services" element={page('my-services')} />
          <Route path="/password/change-required" element={page('change-required')} />
          <Route element={<AdminRoute />}>
            <Route path="/organizations" element={page('organizations')} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const expectPage = (name: string) => expect(screen.getByText(`page:${name}`)).toBeInTheDocument()
/** Not ready yet: a spinner and no route content. */
const expectSpinnerOnly = (container: HTMLElement) => {
  expect(container.querySelector('.cf-spinner')).toBeInTheDocument()
  expect(screen.queryByText(/^page:/)).not.toBeInTheDocument()
}

beforeEach(() => {
  mockedUseAuth.mockReset()
})

describe('ProtectedRoute', () => {
  it('shows only a spinner until auth is ready', () => {
    setAuth({ ready: false })
    const { container } = renderAt('/my-services')
    expectSpinnerOnly(container)
  })

  it('redirects to the login page when not logged in', () => {
    setAuth({})
    renderAt('/my-services')
    expectPage('login')
  })

  it('redirects to 2FA setup when login is pending 2FA setup', () => {
    setAuth({ session: { pendingToken: 'p', requiresTwoFactorSetup: true } })
    renderAt('/my-services')
    expectPage('2fa-setup')
  })

  it('redirects to 2FA verify when login is pending 2FA verification', () => {
    setAuth({ session: { pendingToken: 'p', requiresTwoFactor: true } })
    renderAt('/my-services')
    expectPage('2fa-verify')
  })

  it('redirects to the login page when the session has neither a token nor a pending 2FA step', () => {
    setAuth({ session: { pendingToken: 'p' } })
    renderAt('/my-services')
    expectPage('login')
  })

  it('waits (spinner) while the user is still loading', () => {
    setAuth({ session: signedIn })
    const { container } = renderAt('/my-services')
    expectSpinnerOnly(container)
  })

  it('shows the protected page to an authorized user', () => {
    setAuth({ session: signedIn, user: baseUser })
    renderAt('/my-services')
    expectPage('my-services')
  })

  it('sends a user who must change the password to the change-required page from any protected route', () => {
    setAuth({ session: signedIn, user: { ...baseUser, mustChangePassword: true } })
    renderAt('/my-services')
    expectPage('change-required')
  })

  it('sends an admin who must change the password to the change-required page, even from an admin route', () => {
    setAuth({ session: signedIn, user: { ...baseUser, isSystemAdmin: true, mustChangePassword: true } })
    renderAt('/organizations')
    expectPage('change-required')
  })

  it('lets a user who must change the password stay on the change-required page', () => {
    setAuth({ session: signedIn, user: { ...baseUser, mustChangePassword: true } })
    renderAt('/password/change-required')
    expectPage('change-required')
  })

  it('moves a user who no longer must change the password off the change-required page to their home', () => {
    setAuth({ session: signedIn, user: { ...baseUser, mustChangePassword: false } })
    renderAt('/password/change-required')
    expectPage('my-services')
  })

  it('moves a system admin off the change-required page to the admin home', () => {
    setAuth({ session: signedIn, user: { ...baseUser, isSystemAdmin: true } })
    renderAt('/password/change-required')
    expectPage('organizations')
  })
})

describe('AdminRoute', () => {
  it('shows the admin page to a system admin', () => {
    setAuth({ session: signedIn, user: { ...baseUser, isSystemAdmin: true } })
    renderAt('/organizations')
    expectPage('organizations')
  })

  it('redirects a non-admin to /my-services', () => {
    setAuth({ session: signedIn, user: baseUser })
    renderAt('/organizations')
    expectPage('my-services')
  })

  it('shows only a spinner until auth is ready', () => {
    setAuth({ ready: false })
    const { container } = render(
      <MemoryRouter initialEntries={['/organizations']}>
        <Routes>
          <Route element={<AdminRoute />}>
            <Route path="/organizations" element={<div>page:organizations</div>} />
          </Route>
          <Route path="/my-services" element={<div>page:my-services</div>} />
        </Routes>
      </MemoryRouter>,
    )
    expectSpinnerOnly(container)
  })
})

describe('GuestRoute', () => {
  it('shows the login page when not logged in', () => {
    setAuth({})
    renderAt('/login')
    expectPage('login')
  })

  it('shows only a spinner until auth is ready', () => {
    setAuth({ ready: false })
    const { container } = renderAt('/login')
    expectSpinnerOnly(container)
  })

  it('sends a signed-in user to their home', () => {
    setAuth({ session: signedIn, user: baseUser })
    renderAt('/login')
    expectPage('my-services')
  })

  it('sends a signed-in system admin to the admin home', () => {
    setAuth({ session: signedIn, user: { ...baseUser, isSystemAdmin: true } })
    renderAt('/login')
    expectPage('organizations')
  })

  it('sends a login pending 2FA setup to the setup page', () => {
    setAuth({ session: { pendingToken: 'p', requiresTwoFactorSetup: true } })
    renderAt('/login')
    expectPage('2fa-setup')
  })

  it('sends a login pending 2FA verification to the verify page', () => {
    setAuth({ session: { pendingToken: 'p', requiresTwoFactor: true } })
    renderAt('/login')
    expectPage('2fa-verify')
  })
})

describe('TwoFactorRoute', () => {
  it('shows only a spinner until auth is ready', () => {
    setAuth({ ready: false })
    const { container } = renderAt('/2fa/verify')
    expectSpinnerOnly(container)
  })

  it('redirects to the login page when there is no session', () => {
    setAuth({})
    renderAt('/2fa/verify')
    expectPage('login')
  })

  it('sends an already signed-in user to their home', () => {
    setAuth({ session: signedIn, user: baseUser })
    renderAt('/2fa/setup')
    expectPage('my-services')
  })

  it('shows the setup page when setup is pending', () => {
    setAuth({ session: { pendingToken: 'p', requiresTwoFactorSetup: true } })
    renderAt('/2fa/setup')
    expectPage('2fa-setup')
  })

  it('moves from the setup page to verify when setup is not needed', () => {
    setAuth({ session: { pendingToken: 'p', requiresTwoFactor: true } })
    renderAt('/2fa/setup')
    expectPage('2fa-verify')
  })

  it('shows the verify page when verification is pending', () => {
    setAuth({ session: { pendingToken: 'p', requiresTwoFactor: true } })
    renderAt('/2fa/verify')
    expectPage('2fa-verify')
  })

  it('moves from the verify page to setup when setup is still needed', () => {
    setAuth({ session: { pendingToken: 'p', requiresTwoFactorSetup: true } })
    renderAt('/2fa/verify')
    expectPage('2fa-setup')
  })
})
