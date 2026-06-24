import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getDefaultHomePath } from '../lib/routes'
import { Button } from '../components/ui'

export function Verify2FAPage() {
  const { verify2FA, user } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const err = await verify2FA(code)
    setLoading(false)

    if (err) {
      setError(err)
      return
    }

    navigate(getDefaultHomePath(user?.isAdmin ?? false))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">二階段驗證</h1>
          <p className="mt-2 text-sm text-slate-400">請輸入驗證器 App 上的 6 位數驗證碼</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl"
        >
          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="code" className="block text-sm font-medium text-slate-300">
              驗證碼
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-center text-2xl tracking-[0.5em] text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="000000"
              autoFocus
              required
            />
          </div>

          <Button
            type="submit"
            disabled={loading || code.length !== 6}
            className="mt-6 w-full !bg-indigo-600 hover:!bg-indigo-500"
          >
            {loading ? '驗證中...' : '驗證'}
          </Button>
        </form>
      </div>
    </div>
  )
}
