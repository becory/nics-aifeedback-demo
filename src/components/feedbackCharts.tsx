import { useState } from 'react'
import { CHART_COLORS, dateKeyToMs, formatCompactCount, STATS_FIELD_LABELS, type StatsFilterField, type DimensionFilter } from '../lib/feedbackStats'
import type { FeedbackOverviewInterval } from '../api/feedback'
import { Modal } from './Modal'

const INTERVAL_LABELS: Record<FeedbackOverviewInterval, string> = {
  day: '每日',
  week: '每週',
  month: '每月',
}

const STATS_PREVIEW_LIMIT = 5

export function AnalyticsPanel({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`overflow-hidden rounded-lg border border-slate-200 bg-white ${className}`}>
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

export function SummaryStat({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <div className="bg-white px-4 py-3 sm:px-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

export function FilterChip({
  filter,
  onRemove,
}: {
  filter: Pick<DimensionFilter, 'field' | 'mode' | 'label'>
  onRemove: () => void
}) {
  const operator = filter.mode === 'include' ? '等於' : '不等於'
  return (
    <div className="cf-filter-chip">
      <span className="cf-filter-chip__field">
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="M2.75 4.5h14.5l-5.2 6.3v4.2l-4.1 2.1v-6.3L2.75 4.5Z" />
        </svg>
        {STATS_FIELD_LABELS[filter.field]} {operator}
      </span>
      <span className="cf-filter-chip__value" title={filter.label}>
        {filter.label}
      </span>
      <button type="button" onClick={onRemove} className="cf-filter-chip__remove" aria-label="移除篩選">
        ×
      </button>
    </div>
  )
}

export function TrafficChartSection({
  points,
  interval,
  onIntervalChange,
  avgScore,
  total,
}: {
  points: { date: string; label: string; count: number }[]
  interval: FeedbackOverviewInterval
  onIntervalChange: (interval: FeedbackOverviewInterval) => void
  avgScore: number | null
  total: number
}) {
  return (
    <div className="cf-traffic-layout">
      <div className="cf-traffic-toolbar">
        <select
          value={interval}
          onChange={(e) => onIntervalChange(e.target.value as FeedbackOverviewInterval)}
          className="cf-select"
          aria-label="時間區間"
        >
          {(Object.keys(INTERVAL_LABELS) as FeedbackOverviewInterval[]).map((iv) => (
            <option key={iv} value={iv}>
              {INTERVAL_LABELS[iv]}
            </option>
          ))}
        </select>
      </div>
      <div className="cf-traffic-body">
        <div className="cf-metric-sidebar">
          <div className="cf-metric-card cf-metric-card--active" aria-current="true">
            <p className="cf-metric-card__label">回饋總數</p>
            <p className="cf-metric-card__value">{total.toLocaleString()}</p>
          </div>
          <div className="cf-metric-card">
            <p className="cf-metric-card__label">平均分數</p>
            <p className="cf-metric-card__value">{avgScore != null ? avgScore.toFixed(2) : '—'}</p>
          </div>
        </div>
        <div className="cf-chart-main">
          <p className="cf-chart-main__chart-title">回饋數量</p>
          <TrafficChart points={points} />
        </div>
      </div>
    </div>
  )
}

function ExpandIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M7 3H3v4M13 3h4v4M7 17H3v-4M13 17h4v-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FilterOutIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="10" cy="10" r="7.25" />
      <path d="M6.5 6.5l7 7" strokeLinecap="round" />
    </svg>
  )
}

function FilterForIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M2.75 4.5h14.5l-5.2 6.3v4.2l-4.1 2.1v-6.3L2.75 4.5Z" />
    </svg>
  )
}

export interface TopStatsItem {
  label: string
  value: string
  count: number
}

function StatsItemList({
  items,
  field,
  max,
  onInclude,
  onExclude,
  className = 'flex-1 py-0.5',
}: {
  items: TopStatsItem[]
  field: StatsFilterField
  max: number
  onInclude?: (field: StatsFilterField, value: string, label: string) => void
  onExclude?: (field: StatsFilterField, value: string, label: string) => void
  className?: string
}) {
  return (
    <ul className={className}>
      {items.map((item) => {
        const fillPct = (item.count / max) * 100
        return (
          <li key={`${field}-${item.value}`} className="cf-stat-card__row group">
            <span className="cf-stat-card__label" title={item.label}>
              {item.label}
            </span>
            <div className="cf-stat-card__aside">
              <div className="cf-stat-card__aside-stats">
                <span className="cf-stat-card__count">{formatCompactCount(item.count)}</span>
                <div className="cf-stat-card__bar-track">
                  <div className="cf-stat-card__bar-fill" style={{ width: `${fillPct}%` }} />
                </div>
              </div>
              {(onInclude || onExclude) && (
                <div className="cf-stat-card__aside-actions">
                  {onInclude && (
                    <button
                      type="button"
                      title="僅顯示此項目"
                      aria-label={`篩選 ${item.label}`}
                      onClick={() => onInclude(field, item.value, item.label)}
                      className="cf-action-btn"
                    >
                      <FilterForIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {onExclude && (
                    <button
                      type="button"
                      title="排除此項目"
                      aria-label={`排除 ${item.label}`}
                      onClick={() => onExclude(field, item.value, item.label)}
                      className="cf-action-btn cf-action-btn--danger"
                    >
                      <FilterOutIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function TopStatsPanel({
  title,
  field,
  allItems,
  onInclude,
  onExclude,
  emptyMessage = '尚無資料',
  previewLimit = STATS_PREVIEW_LIMIT,
}: {
  title: string
  field: StatsFilterField
  allItems: TopStatsItem[]
  onInclude?: (field: StatsFilterField, value: string, label: string) => void
  onExclude?: (field: StatsFilterField, value: string, label: string) => void
  emptyMessage?: string
  previewLimit?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const previewItems = allItems.slice(0, previewLimit)
  const previewMax = Math.max(...previewItems.map((i) => i.count), 1)
  const allMax = Math.max(...allItems.map((i) => i.count), 1)

  return (
    <div className="cf-stat-card">
      <div className="cf-stat-card__header">
        <div className="cf-stat-card__title">
          <span className="truncate">{title}</span>
        </div>
        {allItems.length > 0 && (
          <button
            type="button"
            className="cf-icon-btn"
            aria-label={`展開 ${title} 完整清單`}
            title="查看完整清單"
            onClick={() => setExpanded(true)}
          >
            <ExpandIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {allItems.length === 0 ? (
        <p className="px-3 py-8 text-center text-xs text-[#8c8c8c]">{emptyMessage}</p>
      ) : (
        <StatsItemList
          items={previewItems}
          field={field}
          max={previewMax}
          onInclude={onInclude}
          onExclude={onExclude}
        />
      )}

      <Modal open={expanded} title={title} onClose={() => setExpanded(false)} wide>
        <p className="mb-4 text-sm text-slate-500">共 {allItems.length} 項</p>
        <div className="cf-stat-card cf-stat-card--modal">
          <StatsItemList
            items={allItems}
            field={field}
            max={allMax}
            onInclude={
              onInclude &&
              ((f, value, label) => {
                onInclude(f, value, label)
                setExpanded(false)
              })
            }
            onExclude={
              onExclude &&
              ((f, value, label) => {
                onExclude(f, value, label)
                setExpanded(false)
              })
            }
            className="py-0.5"
          />
        </div>
      </Modal>
    </div>
  )
}

export function ChartCard({
  title,
  children,
  className = '',
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <h3 className="mb-3 text-center text-sm font-medium text-slate-700">{title}</h3>
      {children}
    </div>
  )
}

export function ChartLegend({
  items,
}: {
  items: { label: string; color: string }[]
}) {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-4">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 text-xs text-slate-600">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
          {item.label}
        </div>
      ))}
    </div>
  )
}

export function TrafficChart({
  points,
}: {
  points: { date: string; label: string; count: number }[]
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const maxCount = Math.max(...points.map((p) => p.count), 1)
  const chartHeight = 280
  const chartWidth = 1000
  const padding = { top: 12, right: 20, bottom: 48, left: 44 }
  const innerW = chartWidth - padding.left - padding.right
  const innerH = chartHeight - padding.top - padding.bottom
  const color = CHART_COLORS.primary

  const minMs = points.length > 0 ? dateKeyToMs(points[0].date) : 0
  const maxMs = points.length > 0 ? dateKeyToMs(points[points.length - 1].date) : 0
  const timeSpan = Math.max(maxMs - minMs, 1)

  const coords = points.map((p) => {
    const ms = dateKeyToMs(p.date)
    const x = padding.left + ((ms - minMs) / timeSpan) * innerW
    const y = padding.top + innerH - (p.count / maxCount) * innerH
    return { x, y, ...p }
  })

  const linePath = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  const tickIndices = (() => {
    if (points.length <= 1) return points.length === 1 ? [0] : []
    const maxTicks = 8
    if (points.length <= maxTicks) return points.map((_, i) => i)
    const indices = new Set<number>([0, points.length - 1])
    const step = (points.length - 1) / (maxTicks - 1)
    for (let i = 1; i < maxTicks - 1; i++) {
      indices.add(Math.round(i * step))
    }
    return [...indices].sort((a, b) => a - b)
  })()

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    ratio,
    value: Math.round(maxCount * ratio * 10) / 10,
    y: padding.top + innerH * (1 - ratio),
  }))

  const hovered = hoveredIndex != null ? coords[hoveredIndex] : null

  if (points.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-[#8c8c8c]">
        此時間範圍內尚無資料
      </div>
    )
  }

  return (
    <div className="cf-traffic-chart overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full min-w-[640px]"
        role="img"
        aria-label="回饋數量趨勢圖"
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {yTicks.map((tick) => (
          <g key={tick.ratio}>
            <line
              x1={padding.left}
              y1={tick.y}
              x2={chartWidth - padding.right}
              y2={tick.y}
              stroke="#ebebeb"
              strokeWidth={1}
            />
            <text
              x={padding.left - 8}
              y={tick.y + 4}
              textAnchor="end"
              className="fill-[#8c8c8c] text-[11px]"
              style={{ fontFamily: 'inherit' }}
            >
              {tick.value}
            </text>
          </g>
        ))}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {hovered && (
          <line
            x1={hovered.x}
            y1={padding.top}
            x2={hovered.x}
            y2={padding.top + innerH}
            stroke="#d9d9d9"
            strokeWidth={1}
            strokeDasharray="4 3"
            pointerEvents="none"
          />
        )}
        {coords.map((p, i) => {
          const active = hoveredIndex === i
          const showDot = p.count > 0 || active
          return (
            <g key={`${p.date}-${i}`}>
              <circle
                cx={p.x}
                cy={p.y}
                r={10}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
              />
              {showDot && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={active ? 5 : 3}
                  fill={color}
                  stroke="#fff"
                  strokeWidth={active ? 2 : 1.5}
                  pointerEvents="none"
                />
              )}
            </g>
          )
        })}
        {tickIndices.map((i) => {
          const p = coords[i]
          if (!p) return null
          return (
            <text
              key={`tick-${p.date}`}
              x={p.x}
              y={chartHeight - 14}
              textAnchor="middle"
              className="fill-[#595959] text-[11px]"
              style={{ fontFamily: 'inherit' }}
            >
              {p.label}
            </text>
          )
        })}
        {hovered && (
          <g pointerEvents="none">
            {(() => {
              const tooltipW = 108
              const tooltipH = 44
              const tooltipX = Math.min(Math.max(hovered.x - tooltipW / 2, padding.left), chartWidth - padding.right - tooltipW)
              const tooltipY = Math.max(hovered.y - tooltipH - 14, padding.top)
              return (
                <>
                  <rect
                    x={tooltipX}
                    y={tooltipY}
                    width={tooltipW}
                    height={tooltipH}
                    rx={4}
                    fill="#1d1d1d"
                    opacity={0.92}
                  />
                  <text
                    x={tooltipX + tooltipW / 2}
                    y={tooltipY + 18}
                    textAnchor="middle"
                    className="fill-white text-[11px] font-medium"
                    style={{ fontFamily: 'inherit' }}
                  >
                    {hovered.label}
                  </text>
                  <text
                    x={tooltipX + tooltipW / 2}
                    y={tooltipY + 34}
                    textAnchor="middle"
                    className="fill-[#ebebeb] text-[11px]"
                    style={{ fontFamily: 'inherit' }}
                  >
                    {hovered.count} 筆
                  </text>
                </>
              )
            })()}
          </g>
        )}
      </svg>
    </div>
  )
}

export function HorizontalBarChart({
  items,
  maxValue = 100,
  color = CHART_COLORS.score,
}: {
  items: { label: string; value: number }[]
  maxValue?: number
  color?: string
}) {
  const barMax = Math.max(maxValue, ...items.map((i) => i.value), 1)
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between text-xs text-slate-600">
            <span className="truncate pr-2">{item.label}</span>
            <span>{item.value}</span>
          </div>
          <div className="h-5 rounded bg-slate-100">
            <div
              className="h-5 rounded"
              style={{ width: `${(item.value / barMax) * 100}%`, backgroundColor: color }}
            />
          </div>
        </div>
      ))}
      <ChartLegend items={[{ label: 'score', color }]} />
    </div>
  )
}

export function VerticalBarChart({
  items,
  color = CHART_COLORS.good,
  legendLabel = 'good',
}: {
  items: { label: string; count: number }[]
  color?: string
  legendLabel?: string | null
}) {
  const max = Math.max(...items.map((i) => i.count), 1)
  const h = 180
  const barW = Math.min(48, Math.max(24, 280 / Math.max(items.length, 1)))

  return (
    <div>
      <svg viewBox={`0 0 ${Math.max(items.length * (barW + 16), 200)} ${h + 40}`} className="w-full">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = 10 + (h - 10) * (1 - ratio)
          return (
            <g key={ratio}>
              <line x1={30} y1={y} x2={items.length * (barW + 16)} y2={y} stroke="#e2e8f0" />
              <text x={24} y={y + 4} textAnchor="end" className="fill-slate-400 text-[9px]">
                {Math.round(max * ratio)}
              </text>
            </g>
          )
        })}
        {items.map((item, i) => {
          const barH = (item.count / max) * (h - 20)
          const x = 40 + i * (barW + 16)
          const y = h - barH
          return (
            <g key={item.label}>
              <rect x={x} y={y} width={barW} height={barH} fill={color} rx={2} />
              <title>{`${item.label}: ${item.count}`}</title>
              <text x={x + barW / 2} y={h + 14} textAnchor="middle" className="fill-slate-500 text-[8px]">
                {item.label.length > 10 ? `${item.label.slice(0, 10)}…` : item.label}
              </text>
            </g>
          )
        })}
      </svg>
      {legendLabel && <ChartLegend items={[{ label: legendLabel, color }]} />}
    </div>
  )
}

export function StackedVerticalBarChart({
  items,
}: {
  items: { label: string; good: number; normal: number; bad: number }[]
}) {
  const max = Math.max(...items.map((i) => i.good + i.normal + i.bad), 1)
  const h = 180
  const barW = Math.min(48, Math.max(28, 280 / Math.max(items.length, 1)))

  return (
    <div>
      <svg viewBox={`0 0 ${Math.max(items.length * (barW + 20), 220)} ${h + 40}`} className="w-full">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = 10 + (h - 10) * (1 - ratio)
          return (
            <g key={ratio}>
              <line x1={30} y1={y} x2={items.length * (barW + 20)} y2={y} stroke="#e2e8f0" />
              <text x={24} y={y + 4} textAnchor="end" className="fill-slate-400 text-[9px]">
                {Math.round(max * ratio)}
              </text>
            </g>
          )
        })}
        {items.map((item, i) => {
          const scale = (h - 20) / max
          const x = 40 + i * (barW + 20)
          let y = h
          const segments = [
            { val: item.good, color: CHART_COLORS.good },
            { val: item.normal, color: CHART_COLORS.normal },
            { val: item.bad, color: CHART_COLORS.bad },
          ]
          return (
            <g key={item.label}>
              {segments.map((seg) => {
                if (!seg.val) return null
                const barH = seg.val * scale
                y -= barH
                return <rect key={seg.color} x={x} y={y} width={barW} height={barH} fill={seg.color} />
              })}
              <title>{`${item.label}: good ${item.good}, normal ${item.normal}, bad ${item.bad}`}</title>
              <text x={x + barW / 2} y={h + 14} textAnchor="middle" className="fill-slate-500 text-[8px]">
                {item.label.length > 8 ? `${item.label.slice(0, 8)}…` : item.label}
              </text>
            </g>
          )
        })}
      </svg>
      <ChartLegend
        items={[
          { label: 'good', color: CHART_COLORS.good },
          { label: 'normal', color: CHART_COLORS.normal },
        ]}
      />
    </div>
  )
}

export function DonutChart({ good, normal, bad }: { good: number; normal: number; bad: number }) {
  const total = good + normal + bad || 1
  const segments = [
    { value: good, color: CHART_COLORS.good, label: 'good' },
    { value: normal, color: CHART_COLORS.normal, label: 'normal' },
    { value: bad, color: CHART_COLORS.bad, label: 'bad' },
  ].filter((s) => s.value > 0)

  const cx = 100
  const cy = 100
  const r = 70
  const ir = 42
  let angle = -90

  const polar = (radius: number, deg: number) => {
    const rad = (deg * Math.PI) / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }

  const arcs = segments.map((seg) => {
    const sweep = (seg.value / total) * 360
    const start = angle
    const end = angle + sweep
    angle = end
    const large = sweep > 180 ? 1 : 0
    const o1 = polar(r, start)
    const o2 = polar(r, end)
    const i2 = polar(ir, end)
    const i1 = polar(ir, start)
    const d = `M ${o1.x} ${o1.y} A ${r} ${r} 0 ${large} 1 ${o2.x} ${o2.y} L ${i2.x} ${i2.y} A ${ir} ${ir} 0 ${large} 0 ${i1.x} ${i1.y} Z`
    return { ...seg, d, pct: Math.round((seg.value / total) * 1000) / 10 }
  })

  return (
    <div>
      <svg viewBox="0 0 200 200" className="mx-auto h-48 w-48">
        {arcs.map((arc) => (
          <path key={arc.label} d={arc.d} fill={arc.color}>
            <title>{`${arc.label}: ${arc.pct}%`}</title>
          </path>
        ))}
        {arcs.map((arc, i) => {
          const mid =
            -90 +
            arcs.slice(0, i).reduce((s, a) => s + (a.value / total) * 360, 0) +
            ((arc.value / total) * 360) / 2
          const pos = polar((r + ir) / 2, mid)
          if (arc.pct < 8) return null
          return (
            <text
              key={`t-${arc.label}`}
              x={pos.x}
              y={pos.y + 4}
              textAnchor="middle"
              className="fill-white text-[11px] font-medium"
            >
              {arc.pct}%
            </text>
          )
        })}
      </svg>
      <ChartLegend items={segments.map((s) => ({ label: s.label, color: s.color }))} />
    </div>
  )
}

const COUNTRY_COORDS: Record<string, { x: number; y: number }> = {
  TW: { x: 155, y: 95 },
  JP: { x: 175, y: 75 },
  US: { x: 35, y: 80 },
  CN: { x: 130, y: 80 },
}

export function CountryMapChart({ items }: { items: { label: string; count: number }[] }) {
  const max = Math.max(...items.map((i) => i.count), 1)

  return (
    <div>
      <svg viewBox="0 0 220 150" className="w-full rounded-lg bg-slate-50">
        <rect width="220" height="150" fill="#f1f5f9" />
        <text x="110" y="12" textAnchor="middle" className="fill-slate-400 text-[9px]">
          東亞區域
        </text>
        {items.map((item) => {
          const coord = COUNTRY_COORDS[item.label] ?? { x: 110, y: 75 }
          const radius = 12 + (item.count / max) * 28
          return (
            <g key={item.label}>
              <circle cx={coord.x} cy={coord.y} r={radius} fill={CHART_COLORS.good} opacity={0.45} />
              <circle cx={coord.x} cy={coord.y} r={4} fill={CHART_COLORS.good} />
              <text x={coord.x} y={coord.y + radius + 12} textAnchor="middle" className="fill-slate-600 text-[9px]">
                {item.label} ({item.count})
              </text>
            </g>
          )
        })}
      </svg>
      <p className="mt-2 text-center text-xs text-slate-500">圓圈大小代表回饋筆數</p>
    </div>
  )
}
