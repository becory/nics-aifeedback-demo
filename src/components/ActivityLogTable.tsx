import { Fragment, useState } from 'react'
import type { Feedback, FeedbackRating, Organization, Service } from '../types'
import { formatDisplayTime } from '../lib/datetime'

type LogColumnKey =
  | 'createdAt'
  | 'feedbackRating'
  | 'ipCountry'
  | 'ipAddress'
  | 'originHost'
  | 'serviceId'
  | 'userAgent'
  | 'sessionId'
  | 'feedbackComment'
  | 'device'

const ALL_COLUMNS: { key: LogColumnKey; label: string; defaultVisible: boolean }[] = [
  { key: 'createdAt', label: '時間', defaultVisible: true },
  { key: 'feedbackRating', label: '評價', defaultVisible: true },
  { key: 'ipCountry', label: '國家', defaultVisible: true },
  { key: 'ipAddress', label: '來源 IP', defaultVisible: true },
  { key: 'originHost', label: '主機', defaultVisible: true },
  { key: 'serviceId', label: '服務', defaultVisible: true },
  { key: 'userAgent', label: '使用者代理程式', defaultVisible: false },
  { key: 'device', label: '裝置', defaultVisible: false },
  { key: 'sessionId', label: 'Session ID', defaultVisible: false },
  { key: 'feedbackComment', label: '回饋評論', defaultVisible: false },
]

const COLUMN_STORAGE_KEY = 'activity_log_columns'
const PAGE_WINDOW = 5

const ratingBadgeClass: Record<string, string> = {
  good: 'cf-badge cf-badge--good',
  normal: 'cf-badge cf-badge--normal',
  bad: 'cf-badge cf-badge--bad',
}

function loadVisibleColumns(): Set<LogColumnKey> {
  try {
    const raw = localStorage.getItem(COLUMN_STORAGE_KEY)
    if (!raw) {
      return new Set(ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key))
    }
    return new Set(JSON.parse(raw) as LogColumnKey[])
  } catch {
    return new Set(ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key))
  }
}

function rowKey(fb: Feedback): string {
  return `${fb.sessionId}-${fb.createdAt}`
}

function formatServiceName(serviceCode: string, services: Service[]): string {
  return services.find((s) => s.code === serviceCode)?.name ?? '未知'
}

function formatOrganizationName(organizationId: string, organizations: Organization[]): string {
  return organizations.find((o) => o.id === organizationId)?.name ?? '未知'
}

function cellValue(
  fb: Feedback,
  key: LogColumnKey,
  services: Service[],
  ratingLabels: Record<FeedbackRating, string>,
): string {
  switch (key) {
    case 'createdAt':
      return formatDisplayTime(fb.createdAt)
    case 'feedbackRating':
      return ratingLabels[fb.feedbackRating] ?? fb.feedbackRating
    case 'serviceId':
      return formatServiceName(fb.serviceId, services)
    default:
      return String(fb[key] ?? '—')
  }
}

const DETAIL_FIELDS: { key: keyof Feedback; label: string }[] = [
  { key: 'sessionId', label: 'Session ID' },
  { key: 'serviceId', label: '服務' },
  { key: 'originHost', label: '主機' },
  { key: 'ipAddress', label: '來源 IP' },
  { key: 'ipCountry', label: '國家' },
  { key: 'ipAsn', label: 'ASN' },
  { key: 'device', label: '裝置' },
  { key: 'userAgent', label: '使用者代理程式' },
  { key: 'feedbackRating', label: '評價' },
  { key: 'feedbackComment', label: '回饋評論' },
  { key: 'note', label: '備註' },
  { key: 'inferenceSec', label: '推論秒數' },
  { key: 'durationSec', label: '持續秒數' },
  { key: 'createdAt', label: '建立時間' },
]

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 text-[#8c8c8c] transition-transform ${open ? 'rotate-90' : ''}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path d="M7.21 14.77a.75.75 0 0 1 .02-1.06L10.94 10 7.23 6.29a.75.75 0 1 1 1.06-1.06l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.08-.02Z" />
    </svg>
  )
}

/**
 * Server-paged: `feedbacks` is only the current page (already fetched by the parent with
 * page/pageSize), `total` is the filtered total from the backend, and page changes go back
 * through `onPageChange` so the parent can fetch that page.
 */
export function ActivityLogTable({
  feedbacks,
  page,
  pageSize,
  total,
  loading = false,
  error,
  onPageChange,
  services,
  organizations,
  ratingLabels,
}: {
  feedbacks: Feedback[]
  page: number
  /** Rows per page the parent fetched with (server-side paging). */
  pageSize: number
  total: number
  loading?: boolean
  error?: string
  onPageChange: (page: number) => void
  services: Service[]
  organizations: Organization[]
  ratingLabels: Record<FeedbackRating, string>
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showColumnEditor, setShowColumnEditor] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Set<LogColumnKey>>(loadVisibleColumns)

  const columns = ALL_COLUMNS.filter((c) => visibleColumns.has(c.key))
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Up to PAGE_WINDOW page numbers centred on the current page.
  const windowStart = Math.max(1, Math.min(page - Math.floor(PAGE_WINDOW / 2), totalPages - PAGE_WINDOW + 1))
  const pageNumbers = Array.from(
    { length: Math.min(PAGE_WINDOW, totalPages) },
    (_, i) => windowStart + i,
  )

  const goToPage = (next: number) => {
    const clamped = Math.min(totalPages, Math.max(1, next))
    if (clamped === page) return
    setExpandedId(null)
    onPageChange(clamped)
  }

  // "前往 [ ] 頁": typed freely, applied on Enter/blur, clamped to 1..totalPages.
  const [jumpDraft, setJumpDraft] = useState('')
  const submitJump = () => {
    const target = Number.parseInt(jumpDraft, 10)
    setJumpDraft('')
    if (Number.isFinite(target)) goToPage(target)
  }

  const toggleColumn = (key: LogColumnKey) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size <= 2) return prev
        next.delete(key)
      } else {
        next.add(key)
      }
      localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify([...next]))
      return next
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3 sm:px-5">
        <h2 className="cf-section-title">活動記錄</h2>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColumnEditor((v) => !v)}
            className="cf-btn-outline"
          >
            編輯資料欄
          </button>
          {showColumnEditor && (
            <div className="absolute right-0 z-10 mt-1 w-52 rounded border border-[#d9d9d9] bg-white p-2 shadow-md">
              {ALL_COLUMNS.map((col) => (
                <label
                  key={col.key}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] hover:bg-[#f5f5f5]"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(col.key)}
                    onChange={() => toggleColumn(col.key)}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* While a page loads, the current rows stay in place blurred under a spinner, so the
          table doesn't collapse and jump between pages. */}
      <div className="relative" aria-busy={loading}>
        <div
          className={`overflow-x-auto transition ${
            loading && feedbacks.length > 0 ? 'pointer-events-none select-none opacity-60 blur-[2px]' : ''
          }`}
        >
          <table className="cf-log-table">
            <thead>
              <tr>
                <th className="w-8" />
                {columns.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {feedbacks.map((fb) => {
                const rowId = rowKey(fb)
                const open = expandedId === rowId
                return (
                  <Fragment key={rowId}>
                    <tr>
                      <td>
                        <button
                          type="button"
                          onClick={() => setExpandedId(open ? null : rowId)}
                          className="rounded p-0.5 hover:bg-[#ebebeb]"
                          aria-label={open ? '收合詳情' : '展開詳情'}
                        >
                          <ChevronIcon open={open} />
                        </button>
                      </td>
                      {columns.map((col) => (
                        <td key={col.key} className="max-w-[240px] truncate">
                          {col.key === 'feedbackRating' ? (
                            <span className={ratingBadgeClass[fb.feedbackRating] ?? ratingBadgeClass.normal}>
                              {ratingLabels[fb.feedbackRating]}
                            </span>
                          ) : col.key === 'ipCountry' ? (
                            <span className="text-[13px] text-[#1d1d1d]">{fb.ipCountry || '—'}</span>
                          ) : (
                            <span title={cellValue(fb, col.key, services, ratingLabels)}>
                              {cellValue(fb, col.key, services, ratingLabels)}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={columns.length + 1} className="!bg-[#fafafa]">
                          <dl className="grid gap-3 px-2 py-2 sm:grid-cols-2 lg:grid-cols-3">
                            {DETAIL_FIELDS.map(({ key, label }) => (
                              <div key={key} className="min-w-0">
                                <dt className="text-[11px] font-medium text-[#8c8c8c]">{label}</dt>
                                <dd className="truncate text-[13px] text-[#1d1d1d]" title={String(fb[key] ?? '')}>
                                  {key === 'feedbackRating'
                                    ? ratingLabels[fb.feedbackRating]
                                    : key === 'createdAt'
                                      ? formatDisplayTime(fb.createdAt)
                                      : key === 'serviceId'
                                        ? formatServiceName(fb.serviceId, services)
                                        : String(fb[key] ?? '—')}
                                </dd>
                              </div>
                            ))}
                            <div className="min-w-0">
                              <dt className="text-[11px] font-medium text-[#8c8c8c]">組織</dt>
                              <dd className="truncate text-[13px] text-[#1d1d1d]">
                                {formatOrganizationName(fb.organizationId, organizations)}
                              </dd>
                            </div>
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        {loading && feedbacks.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="cf-spinner" />
          </div>
        )}
      </div>

      {error ? (
        <p className="px-4 py-10 text-center text-[13px] text-[#b42318]">{error}</p>
      ) : loading && feedbacks.length === 0 ? (
        <p className="px-4 py-10 text-center text-[13px] text-[#8c8c8c]">載入中…</p>
      ) : total === 0 ? (
        <p className="px-4 py-10 text-center text-[13px] text-[#8c8c8c]">尚無活動記錄</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ebebeb] px-4 py-3 text-[13px] text-[#595959] sm:px-5">
          <p>
            第 {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} 筆，共{' '}
            {total.toLocaleString()} 筆{loading && '（載入中…）'}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => goToPage(page - 1)}
              className="cf-pagination-btn"
            >
              上一頁
            </button>
            {windowStart > 1 && <span className="px-1 text-[#8c8c8c]">…</span>}
            {pageNumbers.map((p) => (
              <button
                key={p}
                type="button"
                disabled={loading}
                onClick={() => goToPage(p)}
                className={`cf-pagination-btn ${p === page ? 'cf-pagination-btn--active' : ''}`}
              >
                {p}
              </button>
            ))}
            {windowStart + pageNumbers.length - 1 < totalPages && (
              <span className="px-1 text-[#8c8c8c]">…</span>
            )}
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => goToPage(page + 1)}
              className="cf-pagination-btn"
            >
              下一頁
            </button>
            <label className="ml-2 flex items-center gap-1">
              前往
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={totalPages}
                value={jumpDraft}
                onChange={(e) => setJumpDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submitJump()
                  }
                }}
                onBlur={submitJump}
                disabled={loading}
                placeholder={String(page)}
                aria-label={`前往頁碼（共 ${totalPages} 頁）`}
                className="h-7 w-14 rounded border border-[#d9d9d9] px-1.5 text-center text-[13px] outline-none focus:border-[#0055dc]"
              />
              / {totalPages} 頁
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
