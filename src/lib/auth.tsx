import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '../types'
import { hashPassword } from '../lib/crypto'
import { findUserByLogin, getData, initStorage, updateUser } from '../lib/storage'
import { createTotpSecret, verifyTotp } from '../lib/totp'

const SESSION_KEY = 'aifeedback_session'

interface AuthContextValue {
  ready: boolean
  session: Session | null
  user: User | null
  login: (username: string, password: string) => Promise<{ error?: string; step?: '2fa_setup' | '2fa_verify' }>
  verify2FA: (code: string) => Promise<string | null>
  setup2FA: (code: string, secret: string) => Promise<string | null>
  logout: () => void
  pendingSecret: string | null
  generatePendingSecret: () => string
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadSession(): Session | null {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  return JSON.parse(raw) as Session
}

function saveSession(session: Session | null): void {
  if (session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } else {
    sessionStorage.removeItem(SESSION_KEY)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [pendingSecret, setPendingSecret] = useState<string | null>(null)

  useEffect(() => {
    initStorage().then(() => {
      setSession(loadSession())
      setReady(true)
    })
  }, [])

  const user = useMemo(() => {
    if (!session) return null
    try {
      return getData().users.find((u) => u.id === session.userId) ?? null
    } catch {
      return null
    }
  }, [session])

  const setAndSave = useCallback((next: Session | null) => {
    setSession(next)
    saveSession(next)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const found = findUserByLogin(username)
    if (!found) return { error: '帳號或密碼錯誤' }

    const hash = await hashPassword(password)
    if (hash !== found.passwordHash) return { error: '帳號或密碼錯誤' }

    if (!found.totpEnabled) {
      setAndSave({ userId: found.id, step: '2fa_setup' })
      return { step: '2fa_setup' as const }
    }

    setAndSave({ userId: found.id, step: '2fa_verify' })
    return { step: '2fa_verify' as const }
  }, [setAndSave])

  const verify2FA = useCallback(async (code: string) => {
    if (!session) return '請先登入'
    const current = getData().users.find((u) => u.id === session.userId)
    if (!current?.totpSecret) return '二階段驗證尚未設定'

    if (!verifyTotp(code, current.totpSecret)) return '驗證碼錯誤'

    setAndSave({ userId: session.userId, step: 'authenticated' })
    return null
  }, [session, setAndSave])

  const generatePendingSecret = useCallback(() => {
    const secret = createTotpSecret()
    setPendingSecret(secret)
    return secret
  }, [])

  const setup2FA = useCallback(async (code: string, secret: string) => {
    if (!session) return '請先登入'

    if (!verifyTotp(code, secret)) return '驗證碼錯誤，請確認已掃描 QR Code'

    updateUser(session.userId, { totpSecret: secret, totpEnabled: true })
    setPendingSecret(null)
    setAndSave({ userId: session.userId, step: 'authenticated' })
    return null
  }, [session, setAndSave])

  const logout = useCallback(() => {
    setPendingSecret(null)
    setAndSave(null)
  }, [setAndSave])

  const value = useMemo(
    () => ({
      ready,
      session,
      user,
      login,
      verify2FA,
      setup2FA,
      logout,
      pendingSecret,
      generatePendingSecret,
    }),
    [
      ready,
      session,
      user,
      login,
      verify2FA,
      setup2FA,
      logout,
      pendingSecret,
      generatePendingSecret,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
