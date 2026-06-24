import { useState } from 'react'
import type { OfflineKey } from '../types'
import { generateAesKey } from '../lib/crypto'
import { getData, saveData } from '../lib/storage'
import { Modal } from '../components/Modal'
import { Button, EmptyState, Input, PageHeader, Select } from '../components/ui'

function generateId() {
  return crypto.randomUUID()
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function defaultExpiresAt(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return toDatetimeLocal(d.toISOString())
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now()
}

export function OfflineKeysPage() {
  const [items, setItems] = useState(() => getData().offlineKeys)
  const [organizations, setOrganizations] = useState(() => getData().organizations)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<OfflineKey | null>(null)
  const [organizationId, setOrganizationId] = useState('')
  const [description, setDescription] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState('')

  const refresh = () => {
    const data = getData()
    setItems(data.offlineKeys)
    setOrganizations(data.organizations)
  }

  const getOrgName = (orgId: string) =>
    organizations.find((o) => o.id === orgId)?.nameZh ?? '—'

  const openCreate = () => {
    setEditing(null)
    setOrganizationId(organizations[0]?.id ?? '')
    setDescription('')
    setExpiresAt(defaultExpiresAt())
    setError('')
    setModalOpen(true)
  }

  const openEdit = (key: OfflineKey) => {
    setEditing(key)
    setOrganizationId(key.organizationId)
    setDescription(key.description)
    setExpiresAt(toDatetimeLocal(key.expiresAt))
    setError('')
    setModalOpen(true)
  }

  const handleSave = () => {
    if (!organizationId) {
      setError('請選擇所屬組織')
      return
    }
    if (!expiresAt) {
      setError('請設定到期時間')
      return
    }

    const expiresAtIso = new Date(expiresAt).toISOString()
    if (new Date(expiresAtIso).getTime() <= Date.now()) {
      setError('到期時間必須晚於現在')
      return
    }

    const data = getData()

    if (editing) {
      data.offlineKeys = data.offlineKeys.map((k) =>
        k.id === editing.id
          ? { ...k, organizationId, description: description.trim(), expiresAt: expiresAtIso }
          : k,
      )
    } else {
      data.offlineKeys.push({
        id: generateId(),
        organizationId,
        description: description.trim(),
        aesKey: generateAesKey(),
        expiresAt: expiresAtIso,
        createdAt: new Date().toISOString(),
      })
    }

    saveData(data)
    refresh()
    setModalOpen(false)
  }

  const handleDelete = (key: OfflineKey) => {
    if (!confirm(`確定要刪除此離線金鑰？`)) return

    const data = getData()
    data.offlineKeys = data.offlineKeys.filter((k) => k.id !== key.id)
    saveData(data)
    refresh()
  }

  const handleCopy = async (aesKey: string) => {
    try {
      await navigator.clipboard.writeText(aesKey)
    } catch {
      // ignore
    }
  }

  return (
    <>
      <PageHeader
        title="離線金鑰"
        description="管理各組織的 AES 離線金鑰，一個組織可擁有多把金鑰"
        action={
          <Button onClick={openCreate} disabled={organizations.length === 0}>
            新增離線金鑰
          </Button>
        }
      />

      {organizations.length === 0 ? (
        <EmptyState message="請先建立組織，才能新增離線金鑰" />
      ) : items.length === 0 ? (
        <EmptyState message="尚無離線金鑰，點擊「新增離線金鑰」開始建立" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-600">所屬組織</th>
                <th className="px-4 py-3 font-medium text-slate-600">說明</th>
                <th className="px-4 py-3 font-medium text-slate-600">AES KEY</th>
                <th className="px-4 py-3 font-medium text-slate-600">到期時間</th>
                <th className="px-4 py-3 font-medium text-slate-600">狀態</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((key) => (
                <tr key={key.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {getOrgName(key.organizationId)}
                  </td>
                  <td className="max-w-[160px] truncate px-4 py-3 text-slate-600">
                    {key.description || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="max-w-[200px] truncate font-mono text-xs text-slate-600">
                        {key.aesKey}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(key.aesKey)}
                        className="shrink-0 text-xs text-indigo-600 hover:text-indigo-800"
                      >
                        複製
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(key.expiresAt)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        isExpired(key.expiresAt)
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {isExpired(key.expiresAt) ? '已過期' : '有效'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openEdit(key)}
                      className="mr-2 text-indigo-600 hover:text-indigo-800"
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(key)}
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
        title={editing ? '編輯離線金鑰' : '新增離線金鑰'}
        onClose={() => setModalOpen(false)}
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}
          <Select
            label="所屬組織"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            options={organizations.map((o) => ({ value: o.id, label: `${o.nameZh} (${o.code})` }))}
          />
          <Input
            label="說明"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="選填，例如：備援節點用金鑰"
          />
          <div className="space-y-1.5">
            <label htmlFor="expiresAt" className="block text-sm font-medium text-slate-700">
              到期時間
            </label>
            <input
              id="expiresAt"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          {!editing && (
            <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
              儲存後將自動產生一組 256-bit AES KEY（Base64 編碼）。
            </p>
          )}
          {editing && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-500">AES KEY</p>
              <p className="mt-1 break-all font-mono text-sm text-slate-700">{editing.aesKey}</p>
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
    </>
  )
}
