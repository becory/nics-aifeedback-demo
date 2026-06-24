import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Feedback } from '../types'
import { formatDisplayTime } from '../lib/datetime'

type ColumnKey = keyof Pick<
  Feedback,
  | 'ipAsn'
  | 'ipCountry'
  | 'ipAddress'
  | 'note'
  | 'createdAt'
  | 'feedbackComment'
  | 'userAgent'
  | 'feedbackRating'
  | 'inferenceSec'
  | 'sessionId'
  | 'serviceId'
  | 'originHost'
  | 'device'
  | 'durationSec'
>

const COLUMNS: { key: ColumnKey; label: string; defaultWidth: number }[] = [
  { key: 'ipAsn', label: 'IP ASN', defaultWidth: 96 },
  { key: 'ipCountry', label: 'IP 國家', defaultWidth: 64 },
  { key: 'ipAddress', label: 'IP 位址', defaultWidth: 108 },
  { key: 'note', label: '備註', defaultWidth: 56 },
  { key: 'createdAt', label: '建立時間', defaultWidth: 132 },
  { key: 'feedbackComment', label: '回饋評論', defaultWidth: 88 },
  { key: 'userAgent', label: '瀏覽器', defaultWidth: 88 },
  { key: 'feedbackRating', label: '回饋評分', defaultWidth: 72 },
  { key: 'inferenceSec', label: '推論秒數', defaultWidth: 72 },
  { key: 'sessionId', label: 'Session ID', defaultWidth: 96 },
  { key: 'serviceId', label: '服務代碼', defaultWidth: 72 },
  { key: 'originHost', label: '來源網域', defaultWidth: 112 },
  { key: 'device', label: '裝置', defaultWidth: 96 },
  { key: 'durationSec', label: '持續秒數', defaultWidth: 72 },
]

const WIDTH_STORAGE_KEY = 'feedback_column_widths'
const MIN_COL_WIDTH = 48

const ratingLabels: Record<string, string> = {
  good: '良好',
  normal: '普通',
  bad: '不佳',
}

const ratingStyles: Record<string, string> = {
  good: 'bg-green-100 text-green-700',
  normal: 'bg-slate-100 text-slate-600',
  bad: 'bg-red-100 text-red-700',
}

function formatDateTime(iso: string): string {
  return formatDisplayTime(iso)
}

function getDefaultWidths(): Record<ColumnKey, number> {
  return Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultWidth])) as Record<ColumnKey, number>
}

function loadWidths(): Record<ColumnKey, number> {
  try {
    const raw = localStorage.getItem(WIDTH_STORAGE_KEY)
    if (!raw) return getDefaultWidths()
    return { ...getDefaultWidths(), ...JSON.parse(raw) }
  } catch {
    return getDefaultWidths()
  }
}

function renderCell(fb: Feedback, key: ColumnKey): ReactNode {
  switch (key) {
    case 'createdAt':
      return formatDateTime(fb.createdAt)
    case 'feedbackComment':
    case 'note':
      return fb[key] || '—'
    case 'feedbackRating':
      return (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            ratingStyles[fb.feedbackRating] ?? ratingStyles.normal
          }`}
        >
          {ratingLabels[fb.feedbackRating] ?? fb.feedbackRating}
        </span>
      )
    case 'sessionId':
      return <span className="font-mono text-xs">{fb.sessionId}</span>
    case 'serviceId':
    case 'ipAddress':
      return <span className="font-mono text-xs">{fb[key]}</span>
    case 'durationSec':
      return fb.durationSec ?? '—'
    default:
      return fb[key] || '—'
  }
}

export function FeedbackTable({
  feedbacks,
  embedded = false,
}: {
  feedbacks: Feedback[]
  embedded?: boolean
}) {
  const [widths, setWidths] = useState<Record<ColumnKey, number>>(loadWidths)
  const resizing = useRef<{ key: ColumnKey; startX: number; startWidth: number } | null>(null)

  const handleResizeStart = useCallback((key: ColumnKey, clientX: number) => {
    resizing.current = { key, startX: clientX, startWidth: widths[key] }
  }, [widths])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizing.current) return
      const { key, startX, startWidth } = resizing.current
      const next = Math.max(MIN_COL_WIDTH, startWidth + (e.clientX - startX))
      setWidths((prev) => ({ ...prev, [key]: next }))
    }
    const onUp = () => {
      if (!resizing.current) return
      resizing.current = null
      setWidths((prev) => {
        localStorage.setItem(WIDTH_STORAGE_KEY, JSON.stringify(prev))
        return prev
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const resetWidths = () => {
    setWidths(getDefaultWidths())
    localStorage.removeItem(WIDTH_STORAGE_KEY)
  }

  return (
    <div
      className={
        embedded
          ? 'overflow-x-auto border-t border-slate-100'
          : 'overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm'
      }
    >
      <div className="flex justify-end border-b border-slate-100 px-3 py-1.5">
        <button
          type="button"
          onClick={resetWidths}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          重設欄寬
        </button>
      </div>
      <table className="w-full table-fixed text-left text-sm">
        <colgroup>
          {COLUMNS.map((col) => (
            <col key={col.key} style={{ width: widths[col.key] }} />
          ))}
        </colgroup>
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className="relative overflow-hidden px-2 py-2.5 font-medium text-slate-600"
              >
                <span className="block truncate text-xs">{col.label}</span>
                <button
                  type="button"
                  aria-label={`調整 ${col.label} 欄寬`}
                  onMouseDown={(e) => handleResizeStart(col.key, e.clientX)}
                  className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize border-r border-transparent hover:border-indigo-300 hover:bg-indigo-100/60"
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {feedbacks.map((fb) => (
            <tr key={fb.id} className="hover:bg-slate-50">
              {COLUMNS.map((col) => (
                <td
                  key={col.key}
                  className="overflow-hidden px-2 py-2 text-slate-600"
                  title={String(fb[col.key] ?? '')}
                >
                  <div className="truncate text-xs">{renderCell(fb, col.key)}</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
