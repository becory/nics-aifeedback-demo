import { useState } from 'react'
import type { User } from '../types'
import { hashPassword } from '../lib/crypto'
import { getData, resetUserTotp, saveData, updateUser } from '../lib/storage'
import { createTotpSecret } from '../lib/totp'
import { Modal } from '../components/Modal'
import { Button, CheckboxGroup, EmptyState, Input, PageHeader } from '../components/ui'

function generateId() {
  return crypto.randomUUID()
}

export function UsersPage() {
  const [items, setItems] = useState(() => getData().users)
  const [organizations, setOrganizations] = useState(() => getData().organizations)
  const [modalOpen, setModalOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [passwordTarget, setPasswordTarget] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [editing, setEditing] = useState<User | null>(null)
  const [nameZh, setNameZh] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [organizationIds, setOrganizationIds] = useState<string[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState('')

  const refresh = () => {
    const data = getData()
    setItems(data.users)
    setOrganizations(data.organizations)
  }

  const getOrgNames = (ids: string[]) =>
    ids
      .map((id) => organizations.find((o) => o.id === id)?.nameZh)
      .filter(Boolean)
      .join('、') || '—'

  const openCreate = () => {
    setEditing(null)
    setNameZh('')
    setEmail('')
    setPassword('')
    setOrganizationIds([])
    setIsAdmin(false)
    setError('')
    setModalOpen(true)
  }

  const openEdit = (user: User) => {
    setEditing(user)
    setNameZh(user.nameZh)
    setEmail(user.email)
    setOrganizationIds([...user.organizationIds])
    setIsAdmin(user.isAdmin)
    setError('')
    setModalOpen(true)
  }

  const openChangePassword = (user: User) => {
    setPasswordTarget(user)
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError('')
    setPasswordModalOpen(true)
  }

  const handleSave = async () => {
    if (!nameZh.trim()) {
      setError('請輸入中文名稱')
      return
    }
    if (!email.trim()) {
      setError('請輸入信箱')
      return
    }
    if (!editing && !password) {
      setError('請輸入密碼')
      return
    }

    const data = getData()
    const normalizedEmail = email.trim().toLowerCase()
    const duplicate = data.users.find(
      (u) => u.email.toLowerCase() === normalizedEmail && u.id !== editing?.id,
    )
    if (duplicate) {
      setError('信箱已存在')
      return
    }

    if (editing) {
      const patch: Partial<User> = {
        nameZh: nameZh.trim(),
        email: normalizedEmail,
        organizationIds,
        isAdmin,
      }

      data.users = data.users.map((u) =>
        u.id === editing.id ? { ...u, ...patch } : u,
      )
    } else {
      data.users.push({
        id: generateId(),
        nameZh: nameZh.trim(),
        email: normalizedEmail,
        passwordHash: await hashPassword(password),
        organizationIds,
        isAdmin,
        totpEnabled: false,
        totpSecret: createTotpSecret(),
      })
    }

    saveData(data)
    refresh()
    setModalOpen(false)
  }

  const handleChangePassword = async () => {
    if (!passwordTarget) return

    setPasswordError('')
    if (!newPassword) {
      setPasswordError('請輸入新密碼')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('新密碼與確認密碼不一致')
      return
    }

    updateUser(passwordTarget.id, { passwordHash: await hashPassword(newPassword) })
    setPasswordModalOpen(false)
    setPasswordTarget(null)
  }

  const handleReset2FA = (user: User) => {
    if (
      !confirm(
        `確定要重設「${user.nameZh}」的二階段驗證？該使用者下次登入時需重新綁定。`,
      )
    ) {
      return
    }

    resetUserTotp(user.id)
    refresh()
  }

  const handleDelete = (user: User) => {
    const data = getData()
    const adminCount = data.users.filter((u) => u.isAdmin).length
    if (user.isAdmin && adminCount <= 1) {
      alert('系統至少需要一位管理員，無法刪除')
      return
    }
    if (!confirm(`確定要刪除使用者「${user.nameZh}」？`)) return

    data.users = data.users.filter((u) => u.id !== user.id)
    saveData(data)
    refresh()
  }

  const orgOptions = organizations.map((o) => ({
    value: o.id,
    label: `${o.nameZh} (${o.code})`,
  }))

  return (
    <>
      <PageHeader
        title="使用者管理"
        description="管理系統使用者帳號與權限（所有使用者均須綁定二階段驗證）"
        action={<Button onClick={openCreate}>新增使用者</Button>}
      />

      {items.length === 0 ? (
        <EmptyState message="尚無使用者資料" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-600">中文名稱</th>
                <th className="px-4 py-3 font-medium text-slate-600">信箱</th>
                <th className="px-4 py-3 font-medium text-slate-600">組織</th>
                <th className="px-4 py-3 font-medium text-slate-600">二階段驗證</th>
                <th className="px-4 py-3 font-medium text-slate-600">管理員</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{user.nameZh}</td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3 text-slate-600">{getOrgNames(user.organizationIds)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.totpEnabled
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {user.totpEnabled ? '已綁定' : '待綁定'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {user.isAdmin ? (
                      <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        是
                      </span>
                    ) : (
                      <span className="text-slate-400">否</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openEdit(user)}
                      className="mr-2 text-indigo-600 hover:text-indigo-800"
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      onClick={() => openChangePassword(user)}
                      className="mr-2 text-indigo-600 hover:text-indigo-800"
                    >
                      修改密碼
                    </button>
                    {user.totpEnabled && (
                      <button
                        type="button"
                        onClick={() => handleReset2FA(user)}
                        className="mr-2 text-amber-600 hover:text-amber-800"
                      >
                        重設二階段驗證
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(user)}
                      className="text-red-600 hover:text-red-800"
                    >
                      刪除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? '編輯使用者' : '新增使用者'}
        onClose={() => setModalOpen(false)}
        wide
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="中文名稱" value={nameZh} onChange={(e) => setNameZh(e.target.value)} />
            <Input
              label="信箱"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {!editing && (
            <Input
              label="密碼"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
          <CheckboxGroup
            label="所屬組織（可多選）"
            options={orgOptions}
            values={organizationIds}
            onChange={setOrganizationIds}
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            管理員
          </label>

          {!editing && (
            <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
              二階段驗證為強制要求，使用者首次登入時須自行完成綁定。
            </p>
          )}

          {editing && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-700">
                二階段驗證狀態：
                <span className="ml-1 font-medium">
                  {editing.totpEnabled ? '已綁定' : '待綁定'}
                </span>
              </p>
              <button
                type="button"
                onClick={() => {
                  openChangePassword(editing)
                  setModalOpen(false)
                }}
                className="mt-2 text-sm text-indigo-600 hover:text-indigo-800"
              >
                修改密碼
              </button>
              {editing.totpEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    handleReset2FA(editing)
                    setModalOpen(false)
                  }}
                  className="mt-2 ml-4 text-sm text-amber-600 hover:text-amber-800"
                >
                  重設二階段驗證
                </button>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>儲存</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={passwordModalOpen}
        title={`修改密碼 — ${passwordTarget?.nameZh ?? ''}`}
        onClose={() => setPasswordModalOpen(false)}
      >
        <div className="space-y-4">
          {passwordError && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{passwordError}</div>
          )}
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
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setPasswordModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleChangePassword}>更新密碼</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
