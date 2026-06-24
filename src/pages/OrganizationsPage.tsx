import { useState } from 'react'
import type { Organization } from '../types'
import { getData, saveData } from '../lib/storage'
import { Modal } from '../components/Modal'
import { Button, EmptyState, Input, PageHeader } from '../components/ui'

function generateId() {
  return crypto.randomUUID()
}

export function OrganizationsPage() {
  const [items, setItems] = useState(() => getData().organizations)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Organization | null>(null)
  const [nameZh, setNameZh] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const refresh = () => setItems(getData().organizations)

  const openCreate = () => {
    setEditing(null)
    setNameZh('')
    setCode('')
    setError('')
    setModalOpen(true)
  }

  const openEdit = (org: Organization) => {
    setEditing(org)
    setNameZh(org.nameZh)
    setCode(org.code)
    setError('')
    setModalOpen(true)
  }

  const handleSave = () => {
    if (!nameZh.trim()) {
      setError('請輸入組織名稱')
      return
    }
    if (!code.trim()) {
      setError('請輸入組織代碼')
      return
    }

    const data = getData()
    const normalizedCode = code.trim().toUpperCase()
    const duplicate = data.organizations.find(
      (o) => o.code.toUpperCase() === normalizedCode && o.id !== editing?.id,
    )
    if (duplicate) {
      setError('組織代碼已存在')
      return
    }

    if (editing) {
      data.organizations = data.organizations.map((o) =>
        o.id === editing.id ? { ...o, nameZh: nameZh.trim(), code: normalizedCode } : o,
      )
    } else {
      data.organizations.push({
        id: generateId(),
        nameZh: nameZh.trim(),
        code: normalizedCode,
      })
    }

    saveData(data)
    refresh()
    setModalOpen(false)
  }

  const handleDelete = (org: Organization) => {
    const data = getData()
    const usedByService = data.services.some((s) => s.organizationId === org.id)
    const usedByUser = data.users.some((u) => u.organizationIds.includes(org.id))
    const usedByOfflineKey = data.offlineKeys.some((k) => k.organizationId === org.id)
    if (usedByService || usedByUser || usedByOfflineKey) {
      alert('此組織已被服務、使用者或離線金鑰引用，無法刪除')
      return
    }
    if (!confirm(`確定要刪除組織「${org.nameZh}」？`)) return

    data.organizations = data.organizations.filter((o) => o.id !== org.id)
    saveData(data)
    refresh()
  }

  return (
    <>
      <PageHeader
        title="組織管理"
        description="管理系統中的組織單位"
        action={
          <Button onClick={openCreate}>新增組織</Button>
        }
      />

      {items.length === 0 ? (
        <EmptyState message="尚無組織資料，點擊「新增組織」開始建立" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-600">組織名稱</th>
                <th className="px-4 py-3 font-medium text-slate-600">組織代碼</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((org) => (
                <tr key={org.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{org.nameZh}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{org.code}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(org)}
                      className="mr-2 text-indigo-600 hover:text-indigo-800"
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(org)}
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
        title={editing ? '編輯組織' : '新增組織'}
        onClose={() => setModalOpen(false)}
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}
          <Input label="組織名稱" value={nameZh} onChange={(e) => setNameZh(e.target.value)} />
          <Input
            label="組織代碼"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="例如：NICS"
          />
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
