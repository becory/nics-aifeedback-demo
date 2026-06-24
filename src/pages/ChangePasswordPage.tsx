import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { hashPassword, verifyPassword } from '../lib/crypto'
import { updateUser } from '../lib/storage'
import { Button, Input, PageHeader } from '../components/ui'

export function ChangePasswordPage() {
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    setSuccess('')

    if (!user) {
      setError('請先登入')
      return
    }
    if (!currentPassword) {
      setError('請輸入目前密碼')
      return
    }
    if (!newPassword) {
      setError('請輸入新密碼')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('新密碼與確認密碼不一致')
      return
    }
    if (newPassword === currentPassword) {
      setError('新密碼不可與目前密碼相同')
      return
    }

    setLoading(true)
    const valid = await verifyPassword(currentPassword, user.passwordHash)
    if (!valid) {
      setLoading(false)
      setError('目前密碼錯誤')
      return
    }

    updateUser(user.id, { passwordHash: await hashPassword(newPassword) })
    setLoading(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setSuccess('密碼已更新')
  }

  return (
    <>
      <PageHeader
        title="修改密碼"
        description="變更您的登入密碼"
      />

      <div className="cf-form-card max-w-md">
        {error && (
          <div className="mb-4 cf-alert cf-alert--error">{error}</div>
        )}
        {success && (
          <div className="mb-4 cf-alert cf-alert--success">{success}</div>
        )}

        <div className="space-y-4">
          <Input
            label="目前密碼"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Input
            label="新密碼"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Input
            label="確認新密碼"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="mt-6"
        >
          {loading ? '更新中...' : '更新密碼'}
        </Button>
      </div>
    </>
  )
}
