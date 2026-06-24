import { useRef, useState } from 'react'
import type { Feedback, Organization, Service } from '../types'
import { parseImportFeedbacksJson } from '../lib/importFeedbacks'
import { Modal } from './Modal'
import { Button } from './ui'

export function FeedbackImportModal({
  open,
  onClose,
  services,
  organizations,
  existing,
  onImported,
}: {
  open: boolean
  onClose: () => void
  services: Service[]
  organizations: Organization[]
  existing: Feedback[]
  onImported: (feedbacks: Feedback[], message: string) => void
}) {
  const [jsonText, setJsonText] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleClose = () => {
    setJsonText('')
    setError('')
    onClose()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      setJsonText(text)
      setError('')
    } catch {
      setError('無法讀取檔案')
    }
    e.target.value = ''
  }

  const handleImport = () => {
    setError('')
    const trimmed = jsonText.trim()
    if (!trimmed) {
      setError('請貼上或選擇 JSON 資料')
      return
    }

    const { items, result } = parseImportFeedbacksJson(trimmed, services, organizations, existing)

    if (result.errors.length > 0 && result.added === 0) {
      setError(result.errors.slice(0, 3).join('；') + (result.errors.length > 3 ? '…' : ''))
      return
    }

    const parts = [`成功匯入 ${result.added} 筆`]
    if (result.skipped > 0) parts.push(`略過 ${result.skipped} 筆重複`)
    if (result.errors.length > 0) parts.push(`${result.errors.length} 筆格式錯誤`)

    onImported(items, parts.join('，'))
    handleClose()
  }

  return (
    <Modal open={open} title="手動匯入資料" onClose={handleClose} wide>
      <p className="mb-4 text-sm text-[#595959]">
        貼上或上傳 JSON 陣列，欄位格式與預設回饋資料相同（需含 sessionId、serviceId、createdAt、feedbackRating 等）。
      </p>

      {error && <div className="cf-alert cf-alert--error">{error}</div>}

      <div className="cf-field">
        <label htmlFor="import-json" className="cf-label">
          JSON 資料
        </label>
        <textarea
          id="import-json"
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          rows={12}
          className="cf-input font-mono text-xs"
          placeholder='[{"sessionId":"...","serviceId":"TEST","createdAt":"2026-06-24T10:00:00","feedbackRating":"good",...}]'
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileChange} />
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            選擇 JSON 檔案
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleClose}>
            取消
          </Button>
          <Button onClick={handleImport}>匯入</Button>
        </div>
      </div>
    </Modal>
  )
}
