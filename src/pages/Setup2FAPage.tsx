import { useEffect, useState, type FormEvent } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getDefaultHomePath } from '../lib/routes'
import { createTotpUri } from '../lib/totp'
import { Button } from '../components/ui'

export function Setup2FAPage() {
  const { user, setup2FA, generatePendingSecret, pendingSecret } = useAuth()
  const navigate = useNavigate()
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (pendingSecret) {
      setSecret(pendingSecret)
    } else if (user?.totpSecret) {
      setSecret(user.totpSecret)
    } else {
      setSecret(generatePendingSecret())
    }
  }, [pendingSecret, generatePendingSecret, user?.totpSecret])

  const uri = secret && user ? createTotpUri(user.email, secret) : ''

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const err = await setup2FA(code, secret)
    setLoading(false)

    if (err) {
      setError(err)
      return
    }

    navigate(getDefaultHomePath(user?.isAdmin ?? false))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">綁定二階段驗證</h1>
          <p className="mt-2 text-sm text-slate-400">
            使用 Google Authenticator 或其他驗證器 App 掃描 QR Code
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl"
        >
          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
          )}

          <div className="mb-6 flex justify-center">
            <div className="rounded-xl bg-white p-4">
              {uri && <QRCodeSVG value={uri} size={180} />}
            </div>
          </div>

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
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-center text-lg tracking-widest text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              placeholder="000000"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={loading || code.length !== 6}
            className="mt-6 w-full !bg-indigo-600 hover:!bg-indigo-500"
          >
            {loading ? '驗證中...' : '完成綁定'}
          </Button>
        </form>
      </div>
    </div>
  )
}
