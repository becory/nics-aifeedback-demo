import { CHART_COLORS } from '../lib/feedbackStats'

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
  hint?: React.ReactNode
}) {
  return (
    <div className="bg-white px-4 py-3 sm:px-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
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
    // Fills its grid row, content centered vertically, so cards side by side match in size
    // even when one chart is shorter than the other.
    <div className={`flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <h3 className="mb-3 text-center text-sm font-medium text-slate-700">{title}</h3>
      <div className="flex flex-1 flex-col justify-center">{children}</div>
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

export function HorizontalBarChart({
  items,
  maxValue = 100,
  color = CHART_COLORS.score,
  legendLabel = null,
  formatValue = (v) => String(v),
}: {
  /** title: hover text for the whole row (defaults to "label: value"). */
  items: { key?: string; label: string; value: number; title?: string }[]
  maxValue?: number
  color?: string
  /** A single series is named by the card title, so no legend unless asked for. */
  legendLabel?: string | null
  formatValue?: (value: number) => string
}) {
  const barMax = Math.max(maxValue, ...items.map((i) => i.value), 1)
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.key ?? item.label} title={item.title ?? `${item.label}: ${formatValue(item.value)}`}>
          <div className="mb-1 flex justify-between text-xs text-slate-600">
            <span className="truncate pr-2">{item.label}</span>
            <span className="tabular-nums">{formatValue(item.value)}</span>
          </div>
          <div className="h-5 rounded bg-slate-100">
            <div
              className="h-5 rounded"
              style={{ width: `${(item.value / barMax) * 100}%`, backgroundColor: color }}
            />
          </div>
        </div>
      ))}
      {legendLabel && <ChartLegend items={[{ label: legendLabel, color }]} />}
    </div>
  )
}

export interface StackedBarSegment {
  key: string
  label: string
  value: number
  color: string
}

/** Horizontal bars split into segments (e.g. ratings), each row scaled to the largest total. */
export function HorizontalStackedBarChart({
  items,
}: {
  items: { key: string; label: string; title?: string; segments: StackedBarSegment[] }[]
}) {
  const totals = items.map((i) => i.segments.reduce((sum, seg) => sum + seg.value, 0))
  const max = Math.max(...totals, 1)
  const legend = items[0]?.segments.map((seg) => ({ label: seg.label, color: seg.color })) ?? []

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={item.key}>
          <div className="mb-1 flex justify-between text-xs text-slate-600">
            <span className="truncate pr-2" title={item.title ?? item.label}>
              {item.label}
            </span>
            <span className="tabular-nums">{totals[i].toLocaleString()}</span>
          </div>
          <div className="h-5 rounded bg-slate-100">
            {/* 2px surface gaps between segments keep adjacent colors distinguishable. */}
            <div className="flex h-5 gap-0.5" style={{ width: `${(totals[i] / max) * 100}%` }}>
              {item.segments
                .filter((seg) => seg.value > 0)
                .map((seg) => (
                  <div
                    key={seg.key}
                    className="h-5 first:rounded-l last:rounded-r"
                    style={{ flexGrow: seg.value, flexBasis: 0, backgroundColor: seg.color }}
                    title={`${item.label}｜${seg.label}：${seg.value.toLocaleString()} 筆（佔 ${
                      Math.round((seg.value / totals[i]) * 1000) / 10
                    }%）`}
                  />
                ))}
            </div>
          </div>
        </div>
      ))}
      {legend.length > 1 && <ChartLegend items={legend} />}
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

export function DonutChart({
  good,
  normal,
  bad,
  labels = {},
}: {
  good: number
  normal: number
  bad: number
  /** Display names per rating (e.g. from ScoreConfig); falls back to the raw key. */
  labels?: Partial<Record<'good' | 'normal' | 'bad', string>>
}) {
  const total = good + normal + bad || 1
  const all = [
    { key: 'good' as const, value: good, color: CHART_COLORS.good },
    { key: 'normal' as const, value: normal, color: CHART_COLORS.normal },
    { key: 'bad' as const, value: bad, color: CHART_COLORS.bad },
  ].map((s) => ({ ...s, label: labels[s.key] ?? s.key, pct: Math.round((s.value / total) * 1000) / 10 }))
  const segments = all.filter((s) => s.value > 0)

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
    // A lone segment is a full ring; an arc from a point to itself would draw nothing.
    const sweep = Math.min((seg.value / total) * 360, 359.99)
    const start = angle
    const end = angle + sweep
    angle = end
    const large = sweep > 180 ? 1 : 0
    const o1 = polar(r, start)
    const o2 = polar(r, end)
    const i2 = polar(ir, end)
    const i1 = polar(ir, start)
    const d = `M ${o1.x} ${o1.y} A ${r} ${r} 0 ${large} 1 ${o2.x} ${o2.y} L ${i2.x} ${i2.y} A ${ir} ${ir} 0 ${large} 0 ${i1.x} ${i1.y} Z`
    return { ...seg, d }
  })

  return (
    // Sized by its container, never the other way round: the content is absolutely positioned,
    // so the donut adds nothing to the row height beyond min-h-40 — the neighbouring chart in the
    // same grid row sets the height, and the ring (viewBox, kept square) fits into what's left.
    <div className="relative h-full min-h-40 overflow-hidden">
      <div className="absolute inset-0 flex items-center gap-4">
        {/* viewBox hugs the ring (outer radius r plus room for the 2px gap stroke), so the
            drawing has no built-in padding and fills the box it is given. */}
        <svg viewBox={`${cx - r - 2} ${cy - r - 2} ${(r + 2) * 2} ${(r + 2) * 2}`} className="h-full min-w-0 flex-1">
          {arcs.map((arc) => (
            // White stroke = the 2px surface gap between adjacent segments.
            <path key={arc.key} d={arc.d} fill={arc.color} stroke="#fff" strokeWidth={2}>
              <title>{`${arc.label}: ${arc.value.toLocaleString()} 筆（${arc.pct}%）`}</title>
            </path>
          ))}
        </svg>
        <ul className="shrink-0 space-y-2 text-xs">
          {all.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="w-20 text-slate-600">{s.label}</span>
              <span className="tabular-nums text-slate-900">{s.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
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
