import { Fragment, useEffect, useMemo, useState } from 'react'
import type { Feedback, FeedbackRating, Organization, Service } from '../types'
import {
  buildServiceByCodeMap,
  formatOrganizationLabel,
  formatServiceLabel,
  resolveOrganizationIdFromFeedback,
} from '../lib/entityLookups'

const PAGE_SIZE = 25

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

const ratingBadgeClass: Record<string, string> = {
  good: 'cf-badge cf-badge--good',
  normal: 'cf-badge cf-badge--normal',
  bad: 'cf-badge cf-badge--bad',
}

function formatLogTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'shortOffset',
  })
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

function cellValue(
  fb: Feedback,
  key: LogColumnKey,
  services: Service[],
  ratingLabels: Record<FeedbackRating, string>,
): string {
  switch (key) {
    case 'createdAt':
      return formatLogTime(fb.createdAt)
    case 'feedbackRating':
      return ratingLabels[fb.feedbackRating] ?? fb.feedbackRating
    case 'serviceId':
      return formatServiceLabel(fb.serviceId, services)
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

export function ActivityLogTable({
  feedbacks,
  services,
  organizations,
  ratingLabels,
}: {
  feedbacks: Feedback[]
  services: Service[]
  organizations: Organization[]
  ratingLabels: Record<FeedbackRating, string>
}) {
  const serviceByCode = useMemo(() => buildServiceByCodeMap(services), [services])
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showColumnEditor, setShowColumnEditor] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Set<LogColumnKey>>(loadVisibleColumns)

  const columns = ALL_COLUMNS.filter((c) => visibleColumns.has(c.key))
  const totalPages = Math.max(1, Math.ceil(feedbacks.length / PAGE_SIZE))

  const pageFeedbacks = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return feedbacks.slice(start, start + PAGE_SIZE)
  }, [feedbacks, page])

  useEffect(() => {
    setPage(1)
    setExpandedId(null)
  }, [feedbacks])

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

  const goToPage = (next: number) => {
    setPage(Math.min(totalPages, Math.max(1, next)))
    setExpandedId(null)
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

      <div className="overflow-x-auto">
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
            {pageFeedbacks.map((fb) => {
              const open = expandedId === fb.id
              return (
                <Fragment key={fb.id}>
                  <tr>
                    <td>
                      <button
                        type="button"
                        onClick={() => setExpandedId(open ? null : fb.id)}
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
                                    ? formatLogTime(fb.createdAt)
                                    : key === 'serviceId'
                                      ? formatServiceLabel(fb.serviceId, services)
                                      : String(fb[key] ?? '—')}
                              </dd>
                            </div>
                          ))}
                          <div className="min-w-0">
                            <dt className="text-[11px] font-medium text-[#8c8c8c]">組織</dt>
                            <dd className="truncate text-[13px] text-[#1d1d1d]">
                              {formatOrganizationLabel(
                                resolveOrganizationIdFromFeedback(fb, serviceByCode),
                                organizations,
                              )}
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

      {feedbacks.length === 0 ? (
        <p className="px-4 py-10 text-center text-[13px] text-[#8c8c8c]">尚無活動記錄</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ebebeb] px-4 py-3 text-[13px] text-[#595959] sm:px-5">
          <p>
            第 {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, feedbacks.length)} 筆，共 {feedbacks.length} 筆
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
              className="cf-pagination-btn"
            >
              上一頁
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = i + 1
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => goToPage(p)}
                  className={`cf-pagination-btn ${p === page ? 'cf-pagination-btn--active' : ''}`}
                >
                  {p}
                </button>
              )
            })}
            {totalPages > 5 && <span className="px-1 text-[#8c8c8c]">…</span>}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
              className="cf-pagination-btn"
            >
              下一頁
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
