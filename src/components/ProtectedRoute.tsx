import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getData } from '../lib/storage'
import { getDefaultHomePath } from '../lib/routes'

export function ProtectedRoute() {
  const { ready, session } = useAuth()

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (session.step === '2fa_setup') return <Navigate to="/2fa/setup" replace />
  if (session.step === '2fa_verify') return <Navigate to="/2fa/verify" replace />
  if (session.step !== 'authenticated') return <Navigate to="/login" replace />

  return <Outlet />
}

export function AdminRoute() {
  const { ready, user } = useAuth()

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  if (!user?.isAdmin) return <Navigate to="/my-services" replace />

  return <Outlet />
}

function getAuthenticatedHome(): string {
  try {
    const session = sessionStorage.getItem('aifeedback_session')
    if (!session) return '/my-services'
    const { userId } = JSON.parse(session) as { userId: string }
    const user = getData().users.find((u) => u.id === userId)
    return getDefaultHomePath(user?.isAdmin ?? false)
  } catch {
    return '/my-services'
  }
}

export function GuestRoute() {
  const { ready, session } = useAuth()

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  if (session?.step === 'authenticated') {
    return <Navigate to={getAuthenticatedHome()} replace />
  }
  if (session?.step === '2fa_setup') return <Navigate to="/2fa/setup" replace />
  if (session?.step === '2fa_verify') return <Navigate to="/2fa/verify" replace />

  return <Outlet />
}

export function TwoFactorRoute({ mode }: { mode: 'setup' | 'verify' }) {
  const { ready, session } = useAuth()

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  if (session.step === 'authenticated') {
    return <Navigate to={getAuthenticatedHome()} replace />
  }
  if (mode === 'setup' && session.step !== '2fa_setup') return <Navigate to="/2fa/verify" replace />
  if (mode === 'verify' && session.step !== '2fa_verify') return <Navigate to="/2fa/setup" replace />

  return <Outlet />
}
