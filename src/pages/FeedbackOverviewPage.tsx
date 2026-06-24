import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import {
  applyDimensionFilters,
  countByField,
  filterFeedbacksByTime,
  DEFAULT_TIME_PRESET,
  getAverageScore,
  getFeedbackTimeRange,
  getRatingCounts,
  getTimeRangeForPreset,
  getUserFeedbacks,
  groupFeedbacksByDay,
  type DimensionFilter,
  type StatsFilterField,
  type TimePreset,
} from '../lib/feedbackStats'
import {
  buildServiceByCodeMap,
  countByOrganizationViaService,
  countByServiceId,
} from '../lib/entityLookups'
import { getData } from '../lib/storage'
import { getScoreMap, getRatingLabelMap } from '../lib/ratingScores'
import { ActivityLogTable } from '../components/ActivityLogTable'
import {
  FilterChip,
  TopStatsPanel,
  TrafficChartSection,
  type TopStatsItem,
} from '../components/feedbackCharts'
import { EmptyState, PageHeader } from '../components/ui'

const RATING_KEYS = ['good', 'normal', 'bad'] as const

function toStatsItems(rows: { label: string; count: number }[]): TopStatsItem[] {
  return rows.map((row) => ({
    label: row.label,
    value: row.label,
    count: row.count,
  }))
}

export function FeedbackOverviewPage() {
  const { user } = useAuth()
  const data = getData()
  const [timePreset, setTimePreset] = useState<TimePreset>(DEFAULT_TIME_PRESET)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [dimensionFilters, setDimensionFilters] = useState<DimensionFilter[]>([])

  const allFeedbacks = useMemo(
    () => getUserFeedbacks(data.feedbacks, user?.organizationIds ?? []),
    [data.feedbacks, user?.organizationIds],
  )

  const timeRange = useMemo(() => getFeedbackTimeRange(allFeedbacks), [allFeedbacks])

  const handlePresetChange = (preset: TimePreset) => {
    setTimePreset(preset)
    const range = getTimeRangeForPreset(preset, timeRange)
    setStartTime(range.start)
    setEndTime(range.end)
  }

  useEffect(() => {
    const range = getTimeRangeForPreset(timePreset, timeRange)
    setStartTime(range.start)
    setEndTime(range.end)
  }, [timePreset, timeRange.min, timeRange.max])

  const timeFiltered = useMemo(
    () => filterFeedbacksByTime(allFeedbacks, startTime, endTime),
    [allFeedbacks, startTime, endTime],
  )

  const filterContext = useMemo(
    () => ({ serviceByCode: buildServiceByCodeMap(data.services) }),
    [data.services],
  )

  const filtered = useMemo(
    () => applyDimensionFilters(timeFiltered, dimensionFilters, filterContext),
    [timeFiltered, dimensionFilters, filterContext],
  )

  const addFilter = useCallback(
    (field: StatsFilterField, value: string, label: string, mode: 'include' | 'exclude') => {
      setDimensionFilters((prev) => {
        const withoutDup = prev.filter((f) => !(f.field === field && f.value === value && f.mode === mode))
        return [
          ...withoutDup,
          {
            id: `${field}-${mode}-${value}-${Date.now()}`,
            field,
            value,
            mode,
            label,
          },
        ]
      })
    },
    [],
  )

  const handleInclude = useCallback(
    (field: StatsFilterField, value: string, label: string) => {
      addFilter(field, value, label, 'include')
    },
    [addFilter],
  )

  const handleExclude = useCallback(
    (field: StatsFilterField, value: string, label: string) => {
      addFilter(field, value, label, 'exclude')
    },
    [addFilter],
  )

  const removeFilter = (id: string) => {
    setDimensionFilters((prev) => prev.filter((f) => f.id !== id))
  }

  const clearAllFilters = () => {
    setTimePreset(DEFAULT_TIME_PRESET)
    const range = getTimeRangeForPreset(DEFAULT_TIME_PRESET, timeRange)
    setStartTime(range.start)
    setEndTime(range.end)
    setDimensionFilters([])
  }

  const scoreMap = useMemo(() => getScoreMap(data.ratingScores), [data.ratingScores])
  const ratingLabels = useMemo(() => getRatingLabelMap(data.ratingScores), [data.ratingScores])

  const dailyTraffic = useMemo(
    () => groupFeedbacksByDay(filtered, startTime, endTime),
    [filtered, startTime, endTime],
  )
  const avgScore = useMemo(() => getAverageScore(filtered, scoreMap), [filtered, scoreMap])
  const ratingCounts = useMemo(() => getRatingCounts(filtered), [filtered])

  const countryItems = useMemo(() => toStatsItems(countByField(filtered, 'ipCountry')), [filtered])
  const asnItems = useMemo(() => toStatsItems(countByField(filtered, 'ipAsn')), [filtered])
  const ipItems = useMemo(() => toStatsItems(countByField(filtered, 'ipAddress')), [filtered])
  const hostItems = useMemo(() => toStatsItems(countByField(filtered, 'originHost')), [filtered])
  const userAgentItems = useMemo(() => toStatsItems(countByField(filtered, 'userAgent')), [filtered])
  const deviceItems = useMemo(() => toStatsItems(countByField(filtered, 'device')), [filtered])
  const serviceItems = useMemo(
    () => countByServiceId(filtered, data.services),
    [filtered, data.services],
  )
  const organizationItems = useMemo(
    () => countByOrganizationViaService(filtered, data.services, data.organizations),
    [filtered, data.services, data.organizations],
  )
  const ratingItems = useMemo<TopStatsItem[]>(
    () =>
      RATING_KEYS.map((key) => ({
        label: ratingLabels[key],
        value: key,
        count: ratingCounts[key],
      })).filter((i) => i.count > 0),
    [ratingCounts, ratingLabels],
  )

  const hasFilters = dimensionFilters.length > 0 || timePreset !== DEFAULT_TIME_PRESET

  return (
    <>
      <PageHeader
        title="回饋資料總覽"
        description="檢視回饋趨勢、平均分數、來源分布與活動記錄"
      />

      {!user?.organizationIds.length ? (
        <EmptyState message="您尚未被指派至任何組織，無法檢視回饋資料總覽" />
      ) : allFeedbacks.length === 0 ? (
        <EmptyState message="目前尚無回饋紀錄" />
      ) : (
        <div className="cf-analytics">
          <div className="cf-panel">
          <TrafficChartSection
            points={dailyTraffic}
            timePreset={timePreset}
            onTimePresetChange={handlePresetChange}
            avgScore={avgScore}
            total={filtered.length}
          />

          <div className="cf-divider px-4 py-5 sm:px-5">
            <h2 className="cf-section-title">熱門流量</h2>
            <p className="cf-section-desc">
              分析所選時間範圍內的回饋來源。將滑鼠移到項目上可篩選或排除。
            </p>

            {hasFilters && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {dimensionFilters.map((f) => (
                  <FilterChip key={f.id} filter={f} onRemove={() => removeFilter(f.id)} />
                ))}
                <button type="button" onClick={clearAllFilters} className="cf-btn-outline !py-1.5 text-[#0055dc]">
                  清除全部篩選
                </button>
              </div>
            )}

            {timeFiltered.length === 0 ? (
              <p className="mt-8 text-center text-sm text-[#8c8c8c]">此時間範圍內尚無回饋紀錄</p>
            ) : filtered.length === 0 ? (
              <p className="mt-8 text-center text-sm text-[#8c8c8c]">目前篩選條件下尚無回饋紀錄</p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <TopStatsPanel title="服務" field="serviceId" allItems={serviceItems} onInclude={handleInclude} onExclude={handleExclude} />
                <TopStatsPanel title="組織" field="organization" allItems={organizationItems} onInclude={handleInclude} onExclude={handleExclude} />
                <TopStatsPanel title="評價" field="feedbackRating" allItems={ratingItems} onInclude={handleInclude} onExclude={handleExclude} />
                <TopStatsPanel title="來源國家/地區" field="ipCountry" allItems={countryItems} onInclude={handleInclude} onExclude={handleExclude} />
                <TopStatsPanel title="主要來源 ASN" field="ipAsn" allItems={asnItems} onInclude={handleInclude} onExclude={handleExclude} />
                <TopStatsPanel title="客戶端 IP 位址" field="ipAddress" allItems={ipItems} onInclude={handleInclude} onExclude={handleExclude} />
                <TopStatsPanel title="主機" field="originHost" allItems={hostItems} onInclude={handleInclude} onExclude={handleExclude} />
                <TopStatsPanel title="使用者代理程式" field="userAgent" allItems={userAgentItems} onInclude={handleInclude} onExclude={handleExclude} />
                <TopStatsPanel title="裝置" field="device" allItems={deviceItems} onInclude={handleInclude} onExclude={handleExclude} />
              </div>
            )}
          </div>

          <div className="cf-divider">
            <ActivityLogTable
              feedbacks={filtered}
              services={data.services}
              organizations={data.organizations}
              ratingLabels={ratingLabels}
            />
          </div>
          </div>
        </div>
      )}
    </>
  )
}
