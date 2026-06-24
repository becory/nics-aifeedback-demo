import { useState } from 'react'
import type { Service } from '../types'
import { getData, saveData } from '../lib/storage'
import { Modal } from '../components/Modal'
import { Button, EmptyState, Input, PageHeader, Select } from '../components/ui'

function generateId() {
  return crypto.randomUUID()
}

export function ServicesPage() {
  const [items, setItems] = useState(() => getData().services)
  const [organizations, setOrganizations] = useState(() => getData().organizations)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [name, setName] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [code, setCode] = useState('')
  const [host, setHost] = useState('')
  const [error, setError] = useState('')

  const refresh = () => {
    const data = getData()
    setItems(data.services)
    setOrganizations(data.organizations)
  }

  const getOrgName = (orgId: string) =>
    organizations.find((o) => o.id === orgId)?.nameZh ?? '—'

  const openCreate = () => {
    setEditing(null)
    setName('')
    setCode('')
    setHost('')
    setOrganizationId(organizations[0]?.id ?? '')
    setError('')
    setModalOpen(true)
  }

  const openEdit = (svc: Service) => {
    setEditing(svc)
    setName(svc.name)
    setCode(svc.code)
    setHost(svc.host)
    setOrganizationId(svc.organizationId)
    setError('')
    setModalOpen(true)
  }

  const handleSave = () => {
    if (!name.trim()) {
      setError('請輸入服務名稱')
      return
    }
    if (!organizationId) {
      setError('請選擇所屬組織')
      return
    }
    if (!code.trim()) {
      setError('請輸入服務代碼')
      return
    }
    if (!host.trim()) {
      setError('請輸入網域')
      return
    }

    const data = getData()
    const normalizedCode = code.trim().toUpperCase()
    const normalizedHost = host.trim().toLowerCase()
    const duplicate = data.services.find(
      (s) => s.code.toUpperCase() === normalizedCode && s.id !== editing?.id,
    )
    if (duplicate) {
      setError('服務代碼已存在')
      return
    }

    if (editing) {
      data.services = data.services.map((s) =>
        s.id === editing.id
          ? {
              ...s,
              name: name.trim(),
              organizationId,
              code: normalizedCode,
              host: normalizedHost,
            }
          : s,
      )
    } else {
      data.services.push({
        id: generateId(),
        name: name.trim(),
        organizationId,
        code: normalizedCode,
        host: normalizedHost,
      })
    }

    saveData(data)
    refresh()
    setModalOpen(false)
  }

  const handleDelete = (svc: Service) => {
    if (!confirm(`確定要刪除服務「${svc.name}」？`)) return

    const data = getData()
    data.services = data.services.filter((s) => s.id !== svc.id)
    saveData(data)
    refresh()
  }

  return (
    <>
      <PageHeader
        title="服務管理"
        description="管理各組織下的服務項目"
        action={
          <Button onClick={openCreate} disabled={organizations.length === 0}>
            新增服務
          </Button>
        }
      />

      {organizations.length === 0 ? (
        <EmptyState message="請先建立組織，才能新增服務" />
      ) : items.length === 0 ? (
        <EmptyState message="尚無服務資料，點擊「新增服務」開始建立" />
      ) : (
        <div className="cf-card">
          <table className="cf-table">
            <thead>
              <tr>
                <th className="px-4 py-3 font-medium text-slate-600">服務名稱</th>
                <th className="px-4 py-3 font-medium text-slate-600">所屬組織</th>
                <th className="px-4 py-3 font-medium text-slate-600">服務代碼</th>
                <th className="px-4 py-3 font-medium text-slate-600">網域</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((svc) => (
                <tr key={svc.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{svc.name}</td>
                  <td className="px-4 py-3 text-slate-600">{getOrgName(svc.organizationId)}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{svc.code}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{svc.host || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(svc)}
                      className="cf-link mr-3"
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(svc)}
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
        title={editing ? '編輯服務' : '新增服務'}
        onClose={() => setModalOpen(false)}
      >
        <div className="space-y-4">
          {error && (
            <div className="cf-alert cf-alert--error">{error}</div>
          )}
          <Input label="服務名稱" value={name} onChange={(e) => setName(e.target.value)} />
          <Select
            label="所屬組織"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            options={organizations.map((o) => ({ value: o.id, label: `${o.nameZh} (${o.code})` }))}
          />
          <Input
            label="服務代碼"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="例如：CHATBOT"
          />
          <Input
            label="網域"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="例如：feedback.example.com"
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
