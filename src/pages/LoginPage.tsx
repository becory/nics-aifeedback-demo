import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Button } from '../components/ui'
import { useAuth } from '../lib/auth'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await login(username, password)
    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    navigate(result.step === '2fa_verify' ? '/2fa/verify' : '/2fa/setup')
  }

  return (
    <AuthLayout title="AI 回饋系統" description="請登入管理後台">
      <form onSubmit={handleSubmit}>
        {error && <div className="cf-alert cf-alert--error">{error}</div>}

        <div className="cf-field">
          <label htmlFor="username" className="cf-label">
            帳號
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="cf-input"
            placeholder="admin"
            autoComplete="username"
            required
          />
        </div>

        <div className="cf-field">
          <label htmlFor="password" className="cf-label">
            密碼
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="cf-input"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        <Button type="submit" disabled={loading} className="cf-btn--block mt-6">
          {loading ? '登入中...' : '登入'}
        </Button>

        <p className="cf-auth__hint">預設帳號：admin / admin（登入後須完成二階段驗證綁定）</p>
      </form>
    </AuthLayout>
  )
}
