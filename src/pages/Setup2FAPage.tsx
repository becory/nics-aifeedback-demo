import { useEffect, useState, type FormEvent } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Button } from '../components/ui'
import { useAuth } from '../lib/auth'
import { getDefaultHomePath } from '../lib/routes'
import { createTotpUri } from '../lib/totp'

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
    <AuthLayout
      wide
      title="綁定二階段驗證"
      description="使用 Google Authenticator 或其他驗證器 App 掃描 QR Code"
    >
      <form onSubmit={handleSubmit}>
        {error && <div className="cf-alert cf-alert--error">{error}</div>}

        <div className="cf-auth__qr">
          <div className="cf-auth__qr-box">{uri && <QRCodeSVG value={uri} size={180} />}</div>
        </div>

        <div className="cf-field">
          <label htmlFor="code" className="cf-label">
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
            className="cf-input cf-input--center text-lg tracking-widest"
            placeholder="000000"
            required
          />
        </div>

        <Button type="submit" disabled={loading || code.length !== 6} className="cf-btn--block mt-6">
          {loading ? '驗證中...' : '完成綁定'}
        </Button>
      </form>
    </AuthLayout>
  )
}
