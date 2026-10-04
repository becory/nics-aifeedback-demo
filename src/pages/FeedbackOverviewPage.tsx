import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Feedback, FeedbackRating, Organization, ScoreConfig, Service } from "../types";
import {
  getFeedbackOverview,
  getFeedbackServiceRatings,
  getFeedbackTopColumns,
  getFeedbacks,
  getOrganizations,
  getScoreConfigs,
  getServices,
  type FeedbackOverview,
  type FeedbackServiceRating,
  type FeedbackTopColumns,
} from "../api";
import { getApiErrorMessage } from "../api/api";
import { ActivityLogTable } from "../components/ActivityLogTable";
import {
  ChartCard,
  DonutChart,
  HorizontalBarChart,
  HorizontalStackedBarChart,
  SummaryStat,
} from "../components/feedbackCharts";
import { FeedbackFilterBar } from "../components/feedbackOverview/FeedbackFilterBar";
import { EmptyState, LoadingState, PageHeader } from "../components/ui";
import {
  buildFeedbackFilterParams,
  filtersFromSearchParams,
  filtersToSearchParams,
  TIME_PRESETS,
  previousTimeRange,
  resolveTimeRange,
  type AppliedFeedbackFilters,
  type TimeRange,
} from "../lib/feedbackFilters";
import { CHART_COLORS, truncateLabel } from "../lib/feedbackStats";

const RATING_KEYS: FeedbackRating[] = ["good", "normal", "bad"];
const ACTIVITY_PAGE_SIZE = 25;
const SERVICE_CHART_LIMIT = 10;

interface PageData {
  current: FeedbackOverview;
  previous: FeedbackOverview | null;
  /** The window `previous` was queried for (null when there is none). */
  previousRange: TimeRange | null;
  ratings: FeedbackTopColumns;
  devices: FeedbackTopColumns;
  serviceRatings: FeedbackServiceRating[];
}

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** datetime-local string -> "2026/08/30 14:05". */
function formatRangePoint(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatRange(range: TimeRange): string {
  return `${formatRangePoint(range.from)} – ${range.to ? formatRangePoint(range.to) : "至今"}`;
}

function ScoreDelta({
  current,
  previous,
  previousRange,
}: {
  current: number | null;
  previous: number | null;
  previousRange: TimeRange | null;
}) {
  if (current === null) return null;
  const title = previousRange ? `上期：${formatRange(previousRange)}` : undefined;
  if (previous === null) return <span title={title}>上期無資料</span>;
  const delta = Math.round((current - previous) * 10) / 10;
  if (delta === 0) return <span title={title}>與上期持平</span>;
  return delta > 0 ? (
    <span className="text-green-700" title={title}>
      較上期 ↑{delta.toFixed(1)}
    </span>
  ) : (
    <span className="text-red-600" title={title}>
      較上期 ↓{Math.abs(delta).toFixed(1)}
    </span>
  );
}

function MoreServicesNote({ total }: { total: number }) {
  if (total <= SERVICE_CHART_LIMIT) return null;
  return (
    <p className="mt-3 text-center text-xs text-slate-400">
      另有 {total - SERVICE_CHART_LIMIT} 個服務
    </p>
  );
}

export function FeedbackOverviewPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [scoreConfigs, setScoreConfigs] = useState<ScoreConfig[]>([]);
  const [baseReady, setBaseReady] = useState(false);

  // Filters and the activity log page live in the query string, so a copied URL reopens the
  // same view. Read once on mount; every change below writes it back.
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialState] = useState(() => filtersFromSearchParams(searchParams));
  const [applied, setApplied] = useState<AppliedFeedbackFilters>(initialState.filters);
  // Resolved once per search, so a relative preset ("近 30 天") and its previous period stay fixed
  // while the page shows that result.
  const [appliedRange, setAppliedRange] = useState<TimeRange>(() =>
    resolveTimeRange(initialState.filters.time),
  );
  const [reloadKey, setReloadKey] = useState(0);

  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [activityPage, setActivityPage] = useState(initialState.page);
  const [activityRows, setActivityRows] = useState<Feedback[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState("");

  useEffect(() => {
    Promise.all([
      getOrganizations({ currentUser: true }),
      getServices({ currentUser: true }),
      getScoreConfigs(),
    ])
      .then(([orgs, svcs, scores]) => {
        setOrganizations(orgs.data.data);
        setServices(svcs.data.data);
        setScoreConfigs(scores.data.data);
      })
      .catch((error) => {
        const detail = getApiErrorMessage(error);
        setLoadError(`載入服務資料時發生錯誤${detail ? `：${detail}` : ""}`);
        setLoading(false);
      })
      .finally(() => setBaseReady(true));
  }, []);

  // null = the service conditions match no service: nothing to query.
  const filterParams = useMemo(
    () => buildFeedbackFilterParams(applied.conditions, services, appliedRange),
    [applied.conditions, services, appliedRange],
  );

  useEffect(() => {
    if (!baseReady || !filterParams) return;
    let cancelled = false;

    const previousRange = previousTimeRange(appliedRange);

    Promise.all([
      getFeedbackOverview(filterParams),
      previousRange
        ? getFeedbackOverview({ ...filterParams, from: previousRange.from, to: previousRange.to })
        : Promise.resolve(null),
      getFeedbackTopColumns({ ...filterParams, groupBy: "rate" }),
      getFeedbackTopColumns({ ...filterParams, groupBy: "device" }),
      getFeedbackServiceRatings(filterParams),
    ])
      .then(([current, previous, ratings, devices, serviceRatings]) => {
        if (cancelled) return;
        setData({
          current: current.data,
          previous: previous?.data ?? null,
          previousRange,
          ratings: ratings.data,
          devices: devices.data,
          serviceRatings: serviceRatings.data.data,
        });
        setLoadError("");
      })
      .catch((error) => {
        if (cancelled) return;
        const detail = getApiErrorMessage(error);
        setData(null);
        setLoadError(`載入回饋資料時發生錯誤${detail ? `：${detail}` : ""}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // appliedRange is read for the previous period, but filterParams already changes with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseReady, filterParams, reloadKey]);

  // Activity log: one backend page at a time (page/pageSize), total from overview.totalCount.
  useEffect(() => {
    if (!baseReady || !filterParams) return;
    let cancelled = false;

    getFeedbacks({ ...filterParams, page: activityPage, pageSize: ACTIVITY_PAGE_SIZE })
      .then((response) => {
        if (cancelled) return;
        setActivityRows(response.data.data);
        setActivityError("");
      })
      .catch((error) => {
        if (cancelled) return;
        const detail = getApiErrorMessage(error);
        setActivityRows([]);
        setActivityError(`載入活動記錄時發生錯誤${detail ? `：${detail}` : ""}`);
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [baseReady, filterParams, activityPage, reloadKey]);

  const apply = (next: AppliedFeedbackFilters) => {
    const range = resolveTimeRange(next.time);
    setApplied(next);
    setAppliedRange(range);
    setActivityPage(1);
    setSearchParams(filtersToSearchParams(next, 1), { replace: true });
    setReloadKey((k) => k + 1);
    if (buildFeedbackFilterParams(next.conditions, services, range)) {
      setLoading(true);
      setActivityLoading(true);
    }
  };

  const retry = () => {
    setLoading(true);
    setActivityLoading(true);
    setReloadKey((k) => k + 1);
  };

  const changeActivityPage = (nextPage: number) => {
    setActivityLoading(true);
    setActivityPage(nextPage);
    setSearchParams(filtersToSearchParams(applied, nextPage), { replace: true });
  };

  const ratingLabels = useMemo<Record<FeedbackRating, string>>(() => {
    // Score configs are good/normal/bad by descending score (same pairing as before the redesign).
    const sorted = [...scoreConfigs].sort((a, b) => b.scoreValue - a.scoreValue);
    const labels = { good: "good", normal: "normal", bad: "bad" } as Record<FeedbackRating, string>;
    RATING_KEYS.forEach((key, i) => {
      if (sorted[i]) labels[key] = sorted[i].name;
    });
    return labels;
  }, [scoreConfigs]);

  const ratingCounts = useMemo(() => {
    const counts: Record<FeedbackRating, number> = { good: 0, normal: 0, bad: 0 };
    for (const item of data?.ratings.items ?? []) {
      if (item.value in counts) counts[item.value as FeedbackRating] = item.count;
    }
    return counts;
  }, [data]);

  const presetLabel =
    applied.time.preset === "custom"
      ? null
      : TIME_PRESETS.find((p) => p.key === applied.time.preset)?.label;

  const renderContent = () => {
    if (!filterParams) return <EmptyState message="沒有符合篩選條件的服務" />;
    if (loading) return <LoadingState />;
    if (!data) return null;
    if (data.current.totalCount === 0) return <EmptyState message="此條件下沒有回饋紀錄" />;

    const { current, previous, devices, serviceRatings } = data;
    const ratedTotal = ratingCounts.good + ratingCounts.normal + ratingCounts.bad;
    const goodRate = ratedTotal > 0 ? (ratingCounts.good / ratedTotal) * 100 : null;

    const scoreItems = serviceRatings
      .filter((s) => s.averageScore !== null)
      .sort((a, b) => b.averageScore! - a.averageScore! || b.totalCount - a.totalCount);
    const deviceMax = Math.max(...devices.items.map((i) => i.count), 1);

    return (
      <>
        <section className="px-4 py-5 sm:px-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="cf-section-title">總覽</h2>
            <p className="text-xs text-slate-500">
              資料區間：{formatRange(appliedRange)}
              {presetLabel && `（${presetLabel}）`}
            </p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <SummaryStat
                label="總平均分數"
                value={current.averageScore === null ? "—" : current.averageScore.toFixed(1)}
                hint={
                  <ScoreDelta
                    current={current.averageScore}
                    previous={previous?.averageScore ?? null}
                    previousRange={data.previousRange}
                  />
                }
              />
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <SummaryStat
                label="好評率"
                value={goodRate === null ? "—" : `${goodRate.toFixed(1)}%`}
                hint={`共 ${ratingCounts.good.toLocaleString()} 筆 ${ratingLabels.good}`}
              />
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <SummaryStat
                label="總回饋筆數"
                value={current.totalCount.toLocaleString()}
                hint="本期累計"
              />
            </div>
          </div>
        </section>

        <section className="cf-divider px-4 py-5 sm:px-5">
          <h2 className="cf-section-title">服務評分</h2>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <ChartCard title="各服務平均分數">
              {scoreItems.length === 0 ? (
                <p className="text-center text-sm text-slate-400">尚無可計分的回饋</p>
              ) : (
                <>
                  <HorizontalBarChart
                    items={scoreItems.slice(0, SERVICE_CHART_LIMIT).map((s) => ({
                      key: s.serviceId,
                      label: truncateLabel(s.label),
                      value: Math.round(s.averageScore! * 10) / 10,
                      title: `${s.label}（${s.serviceId}）：${formatScore(Math.round(s.averageScore! * 10) / 10)} 分，${s.totalCount.toLocaleString()} 筆`,
                    }))}
                    maxValue={100}
                    formatValue={formatScore}
                  />
                  <MoreServicesNote total={scoreItems.length} />
                </>
              )}
            </ChartCard>
            <ChartCard title="整體評價分佈">
              <DonutChart
                good={ratingCounts.good}
                normal={ratingCounts.normal}
                bad={ratingCounts.bad}
                labels={ratingLabels}
              />
            </ChartCard>
          </div>
        </section>

        <section className="cf-divider px-4 py-5 sm:px-5">
          <h2 className="cf-section-title">回饋來源</h2>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <ChartCard title="各服務回饋數">
              <HorizontalStackedBarChart
                items={serviceRatings.slice(0, SERVICE_CHART_LIMIT).map((s) => ({
                  key: s.serviceId,
                  label: truncateLabel(s.label),
                  title: `${s.label}（${s.serviceId}）`,
                  segments: RATING_KEYS.map((r) => ({
                    key: r,
                    label: ratingLabels[r],
                    value: s.ratingCounts[r] ?? 0,
                    color: CHART_COLORS[r],
                  })),
                }))}
              />
              <MoreServicesNote total={serviceRatings.length} />
            </ChartCard>
            <ChartCard title="主要裝置">
              <HorizontalBarChart
                items={devices.items.map((d) => ({
                  key: d.value,
                  label: truncateLabel(d.label || "未知"),
                  value: d.count,
                  title: `${d.label || "未知"}：${d.count.toLocaleString()} 筆`,
                }))}
                maxValue={deviceMax}
                color={CHART_COLORS.score}
                formatValue={(v) => v.toLocaleString()}
              />
              <p className="mt-3 text-center text-xs text-slate-500">
                共 {devices.distinctCount.toLocaleString()} 種裝置類型
                {devices.distinctCount > devices.items.length ? `，顯示前 ${devices.items.length} 名` : ""}
              </p>
            </ChartCard>
          </div>
        </section>

        <div className="cf-divider">
          <ActivityLogTable
            feedbacks={activityRows}
            page={activityPage}
            pageSize={ACTIVITY_PAGE_SIZE}
            total={current.totalCount}
            loading={activityLoading}
            error={activityError}
            onPageChange={changeActivityPage}
            services={services}
            organizations={organizations}
            ratingLabels={ratingLabels}
          />
        </div>
      </>
    );
  };

  return (
    <div className="cf-analytics">
      <PageHeader
        title="回饋資料總覽"
        description="檢視平均分數、評價分佈、回饋來源與活動記錄"
      />

      {loadError && (
        <div className="cf-alert cf-alert--error mb-4 flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <button type="button" onClick={retry} className="cf-link shrink-0">
            重試
          </button>
        </div>
      )}

      <div className="cf-panel">
        <FeedbackFilterBar value={applied} ratingLabels={ratingLabels} onChange={apply} />
        <div className="cf-divider">{renderContent()}</div>
      </div>
    </div>
  );
}
