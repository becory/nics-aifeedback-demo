import { useEffect, useMemo, useState } from "react";
import type { Feedback, FeedbackRating, Organization, ScoreConfig, Service } from "../types";
import {
  getFeedbackOverview,
  getFeedbackTopColumns,
  getFeedbacks,
  getOrganizations,
  getScoreConfigs,
  getServices,
  type FeedbackGroupBy,
  type FeedbackOverview,
  type FeedbackOverviewInterval,
} from "../api";
import { getApiErrorMessage } from "../api/api";
import { ActivityLogTable } from "../components/ActivityLogTable";
import {
  FilterChip,
  TopStatsPanel,
  TrafficChartSection,
  type TopStatsItem,
} from "../components/feedbackCharts";
import type { DimensionFilter, StatsFilterField } from "../lib/feedbackStats";
import { EmptyState, Input, LoadingState, PageHeader, Select } from "../components/ui";

const RATING_KEYS: FeedbackRating[] = ["good", "normal", "bad"];
const FETCH_PAGE_SIZE = 1000;

const RATING_OPTIONS = [
  { value: "", label: "全部評價" },
  { value: "good", label: "good" },
  { value: "normal", label: "normal" },
  { value: "bad", label: "bad" },
];

interface Filters {
  organizationId: string;
  serviceId: string;
  feedbackRating: string;
  device: string;
  ipCountry: string;
  sessionId: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = {
  organizationId: "",
  serviceId: "",
  feedbackRating: "",
  device: "",
  ipCountry: "",
  sessionId: "",
  from: "",
  to: "",
};

interface StatsDimension {
  field: StatsFilterField;
  groupBy: FeedbackGroupBy;
  title: string;
  // filter-bar field that also feeds an "include" value into this dimension, if any
  formKey?: keyof Filters;
}

const STATS_DIMENSIONS: StatsDimension[] = [
  { field: "serviceId", groupBy: "service", title: "服務", formKey: "serviceId" },
  { field: "organization", groupBy: "org", title: "組織", formKey: "organizationId" },
  { field: "feedbackRating", groupBy: "rate", title: "評價", formKey: "feedbackRating" },
  { field: "ipCountry", groupBy: "ip_country", title: "來源國家/地區", formKey: "ipCountry" },
  { field: "ipAsn", groupBy: "ip_asn", title: "主要來源 ASN" },
  { field: "ipAddress", groupBy: "ip", title: "客戶端 IP 位址" },
  { field: "originHost", groupBy: "origin_host", title: "主機" },
  { field: "userAgent", groupBy: "user_agent", title: "使用者代理程式" },
  { field: "device", groupBy: "device", title: "裝置", formKey: "device" },
];

function formatDayLabel(date: string): string {
  const [y, m, d] = date.split("-");
  return `${y}/${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

function buildFilterValue(
  formValue: string,
  statsField: StatsFilterField | undefined,
  dimensionFilters: DimensionFilter[],
): string | string[] | undefined {
  const matching = statsField
    ? dimensionFilters.filter((f) => f.field === statsField)
    : [];
  const includes = matching.filter((f) => f.mode === "include").map((f) => f.value);
  const excludes = matching
    .filter((f) => f.mode === "exclude")
    .map((f) => `-${f.value}`);
  const values = [...(formValue ? [formValue] : []), ...includes, ...excludes];
  if (values.length === 0) return undefined;
  return values.length === 1 ? values[0] : values;
}

const FILTER_LABELS: Record<keyof Filters, string> = {
  organizationId: "組織",
  serviceId: "服務",
  feedbackRating: "評價",
  device: "裝置",
  ipCountry: "來源國家/地區",
  sessionId: "Session ID",
  from: "起始時間",
  to: "結束時間",
};

export function FeedbackOverviewPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [ratingConfigs, setRatingConfigs] = useState<
    Partial<Record<FeedbackRating, ScoreConfig>>
  >({});

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [dimensionFilters, setDimensionFilters] = useState<DimensionFilter[]>([]);
  const [interval, setInterval] = useState<FeedbackOverviewInterval>("day");

  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [overview, setOverview] = useState<FeedbackOverview | null>(null);
  const [topColumns, setTopColumns] = useState<
    Partial<Record<StatsFilterField, TopStatsItem[]>>
  >({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    getOrganizations({ currentUser: true }).then((res) =>
      setOrganizations(res.data.data),
    );
    getServices({ currentUser: true }).then((res) => setServices(res.data.data));
    getScoreConfigs().then((res) => {
      const sorted = [...res.data.data].sort(
        (a, b) => b.scoreValue - a.scoreValue,
      );
      const next: Partial<Record<FeedbackRating, ScoreConfig>> = {};
      RATING_KEYS.forEach((key, index) => {
        if (sorted[index]) next[key] = sorted[index];
      });
      setRatingConfigs(next);
    });
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const filterParams = {
        organizationId: buildFilterValue(
          appliedFilters.organizationId,
          "organization",
          dimensionFilters,
        ),
        serviceId: buildFilterValue(
          appliedFilters.serviceId,
          "serviceId",
          dimensionFilters,
        ),
        feedbackRating: buildFilterValue(
          appliedFilters.feedbackRating,
          "feedbackRating",
          dimensionFilters,
        ),
        device: buildFilterValue(appliedFilters.device, "device", dimensionFilters),
        ipCountry: buildFilterValue(
          appliedFilters.ipCountry,
          "ipCountry",
          dimensionFilters,
        ),
        ipAsn: buildFilterValue("", "ipAsn", dimensionFilters),
        ipAddress: buildFilterValue("", "ipAddress", dimensionFilters),
        originHost: buildFilterValue("", "originHost", dimensionFilters),
        userAgent: buildFilterValue("", "userAgent", dimensionFilters),
        sessionId: appliedFilters.sessionId || undefined,
        from: appliedFilters.from || undefined,
        to: appliedFilters.to || undefined,
      };

      const [feedbacksRes, overviewRes, ...topColumnsRes] = await Promise.all([
        getFeedbacks({ ...filterParams, page: 1, pageSize: FETCH_PAGE_SIZE }),
        getFeedbackOverview({ ...filterParams, interval }),
        ...STATS_DIMENSIONS.map((d) =>
          getFeedbackTopColumns({ ...filterParams, groupBy: d.groupBy }),
        ),
      ]);

      setFeedbacks(feedbacksRes.data.data);
      setOverview(overviewRes.data);

      const nextTopColumns: Partial<Record<StatsFilterField, TopStatsItem[]>> = {};
      STATS_DIMENSIONS.forEach((d, i) => {
        nextTopColumns[d.field] = topColumnsRes[i].data.items.map((item) => ({
          label: item.label,
          value: item.value,
          count: item.count,
        }));
      });
      setTopColumns(nextTopColumns);
      setLoadError("");
    } catch (error) {
      const detail = getApiErrorMessage(error);
      setLoadError(`載入回饋資料時發生錯誤${detail ? `：${detail}` : ""}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters, dimensionFilters, interval]);

  const ratingLabels = useMemo<Record<FeedbackRating, string>>(
    () => ({
      good: ratingConfigs.good?.name ?? "good",
      normal: ratingConfigs.normal?.name ?? "normal",
      bad: ratingConfigs.bad?.name ?? "bad",
    }),
    [ratingConfigs],
  );

  const dailyTraffic = useMemo(
    () =>
      (overview?.counts ?? []).map((c) => ({
        date: c.date,
        label: formatDayLabel(c.date),
        count: c.count,
      })),
    [overview],
  );

  const organizationOptions = [
    { value: "", label: "全部組織" },
    ...organizations.map((o) => ({ value: o.id, label: o.name })),
  ];
  const serviceOptions = [
    { value: "", label: "全部服務" },
    ...services.map((s) => ({ value: s.code, label: s.name })),
  ];

  const applyFilters = () => {
    setAppliedFilters(filters);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setDimensionFilters([]);
  };

  const removeFilter = (key: keyof Filters) => {
    setFilters((f) => ({ ...f, [key]: "" }));
    setAppliedFilters((f) => ({ ...f, [key]: "" }));
  };

  const addDimensionFilter = (
    field: StatsFilterField,
    value: string,
    label: string,
    mode: "include" | "exclude",
  ) => {
    setDimensionFilters((prev) => {
      const withoutDup = prev.filter(
        (f) => !(f.field === field && f.value === value && f.mode === mode),
      );
      return [
        ...withoutDup,
        { id: `${field}-${mode}-${value}-${Date.now()}`, field, value, mode, label },
      ];
    });
  };

  const handleInclude = (field: StatsFilterField, value: string, label: string) =>
    addDimensionFilter(field, value, label, "include");

  const handleExclude = (field: StatsFilterField, value: string, label: string) =>
    addDimensionFilter(field, value, label, "exclude");

  const removeDimensionFilter = (id: string) => {
    setDimensionFilters((prev) => prev.filter((f) => f.id !== id));
  };

  const activeFilterChips = (Object.keys(EMPTY_FILTERS) as (keyof Filters)[])
    .filter((key) => appliedFilters[key])
    .map((key) => {
      const value = appliedFilters[key];
      let valueLabel = value;
      if (key === "organizationId") {
        valueLabel = organizations.find((o) => o.id === value)?.name ?? value;
      } else if (key === "serviceId") {
        valueLabel = services.find((s) => s.code === value)?.name ?? value;
      }
      return { key, label: FILTER_LABELS[key], valueLabel };
    });

  return (
    <div className="cf-analytics">
      <PageHeader
        title="回饋資料總覽"
        description="檢視回饋趨勢、平均分數、來源分布與活動記錄"
      />

      <div className="cf-card mb-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="組織"
            options={organizationOptions}
            value={filters.organizationId}
            onChange={(e) =>
              setFilters((f) => ({ ...f, organizationId: e.target.value }))
            }
          />
          <Select
            label="服務"
            options={serviceOptions}
            value={filters.serviceId}
            onChange={(e) =>
              setFilters((f) => ({ ...f, serviceId: e.target.value }))
            }
          />
          <Select
            label="評價"
            options={RATING_OPTIONS}
            value={filters.feedbackRating}
            onChange={(e) =>
              setFilters((f) => ({ ...f, feedbackRating: e.target.value }))
            }
          />
          <Input
            label="裝置"
            value={filters.device}
            onChange={(e) => setFilters((f) => ({ ...f, device: e.target.value }))}
          />
          <Input
            label="來源國家/地區"
            value={filters.ipCountry}
            onChange={(e) =>
              setFilters((f) => ({ ...f, ipCountry: e.target.value }))
            }
          />
          <Input
            label="Session ID"
            value={filters.sessionId}
            onChange={(e) =>
              setFilters((f) => ({ ...f, sessionId: e.target.value }))
            }
          />
          <Input
            label="起始時間"
            type="datetime-local"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          />
          <Input
            label="結束時間"
            type="datetime-local"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          />
        </div>

        {(activeFilterChips.length > 0 || dimensionFilters.length > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {activeFilterChips.map((chip) => (
              <span key={chip.key} className="cf-filter-chip">
                <span className="cf-filter-chip__field">{chip.label}</span>
                <span className="cf-filter-chip__value" title={chip.valueLabel}>
                  {chip.valueLabel}
                </span>
                <button
                  type="button"
                  onClick={() => removeFilter(chip.key)}
                  className="cf-filter-chip__remove"
                  aria-label={`移除 ${chip.label} 篩選`}
                >
                  ×
                </button>
              </span>
            ))}
            {dimensionFilters.map((f) => (
              <FilterChip
                key={f.id}
                filter={f}
                onRemove={() => removeDimensionFilter(f.id)}
              />
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={clearFilters} className="cf-btn-outline">
            清除篩選
          </button>
          <button
            type="button"
            onClick={applyFilters}
            className="cf-btn cf-btn--primary"
          >
            套用篩選
          </button>
        </div>
      </div>

      {loadError && (
        <div className="cf-alert cf-alert--error mb-4 flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <button type="button" onClick={refresh} className="cf-link shrink-0">
            重試
          </button>
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : !overview || overview.totalCount === 0 ? (
        <EmptyState message="目前尚無回饋紀錄" />
      ) : (
        <div className="cf-panel">
          <TrafficChartSection
            points={dailyTraffic}
            interval={interval}
            onIntervalChange={setInterval}
            avgScore={overview.averageScore}
            total={overview.totalCount}
          />

          <div className="cf-divider px-4 py-5 sm:px-5">
            <h2 className="cf-section-title">熱門流量</h2>
            <p className="cf-section-desc">
              分析所選篩選條件下的回饋來源分布（顯示前 5 名）。
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {STATS_DIMENSIONS.map((d) => (
                <TopStatsPanel
                  key={d.field}
                  title={d.title}
                  field={d.field}
                  allItems={topColumns[d.field] ?? []}
                  onInclude={handleInclude}
                  onExclude={handleExclude}
                />
              ))}
            </div>
          </div>

          <div className="cf-divider">
            <ActivityLogTable
              feedbacks={feedbacks}
              services={services}
              organizations={organizations}
              ratingLabels={ratingLabels}
            />
          </div>
        </div>
      )}
    </div>
  );
}
