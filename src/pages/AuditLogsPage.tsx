import { useEffect, useMemo, useState } from "react";
import { getAgents, getAuditLogs, getOrganizations, getUsers } from "../api";
import type { GetAuditLogsParams } from "../api";
import { getApiErrorMessage } from "../api/api";
import { AuditLogDetailModal } from "../components/AuditLogDetailModal";
import {
  Button,
  CheckboxGroup,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from "../components/ui";
import {
  AUDIT_EVENT_CATEGORIES,
  AUDIT_QUERY_EVENT_TYPE,
  auditEventLabel,
  isWarningOrAbove,
  severityBadgeClass,
} from "../lib/auditLog";
import { formatDisplayTime } from "../lib/datetime";
import { toDatetimeLocal } from "../lib/feedbackStats";
import type { Agent, AuditLogEntry, Organization, User } from "../types";

const PAGE_SIZE = 50;

const SEVERITY_OPTIONS = [
  { value: "", label: "全部" },
  { value: "WARNING", label: "警告以上" },
  { value: "ERROR", label: "錯誤以上" },
];

const QUICK_RANGES = [
  { label: "最近 24 小時", hours: 24 },
  { label: "最近 7 天", hours: 24 * 7 },
  { label: "最近 30 天", hours: 24 * 30 },
];

interface Filters {
  from: string;
  to: string;
  categories: string[];
  hideAuditQueries: boolean;
  minSeverity: string;
  userId: string;
  userEmail: string;
  targetUserId: string;
  organizationId: string;
  agentId: string;
  clientIp: string;
}

function hoursAgoLocal(hours: number): string {
  return toDatetimeLocal(new Date(Date.now() - hours * 3600_000).toISOString());
}

function defaultFilters(): Filters {
  return {
    from: hoursAgoLocal(24 * 7),
    to: "",
    categories: [],
    hideAuditQueries: true,
    minSeverity: "",
    userId: "",
    userEmail: "",
    targetUserId: "",
    organizationId: "",
    agentId: "",
    clientIp: "",
  };
}

function one(value: string): string[] | undefined {
  const trimmed = value.trim();
  return trimmed ? [trimmed] : undefined;
}

function toParams(filters: Filters): GetAuditLogsParams {
  const eventType = AUDIT_EVENT_CATEGORIES.filter((c) =>
    filters.categories.includes(c.value),
  ).flatMap((c) => c.prefixes);
  if (filters.hideAuditQueries) eventType.push(`-${AUDIT_QUERY_EVENT_TYPE}`);

  return {
    eventType: eventType.length ? eventType : undefined,
    userId: one(filters.userId),
    userEmail: one(filters.userEmail),
    targetUserId: one(filters.targetUserId),
    organizationId: one(filters.organizationId),
    agentId: one(filters.agentId),
    clientIp: one(filters.clientIp),
    minSeverity: (filters.minSeverity || undefined) as GetAuditLogsParams["minSeverity"],
    from: filters.from ? new Date(filters.from).toISOString() : undefined,
    to: filters.to ? new Date(filters.to).toISOString() : undefined,
    pageSize: PAGE_SIZE,
  };
}

function propertyString(entry: AuditLogEntry, key: string): string | undefined {
  const value = entry.properties[key];
  return typeof value === "string" && value ? value : undefined;
}

export function AuditLogsPage() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  // The params of the query currently on screen, so "載入更多" keeps paging the same query
  // even if the filter form has been edited since.
  const [appliedParams, setAppliedParams] = useState<GetAuditLogsParams>(() =>
    toParams(defaultFilters()),
  );
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Dropdown sources are best-effort: without them the filters still work via email/IP and
    // the list falls back to raw ids.
    Promise.allSettled([getUsers(), getOrganizations(), getAgents()]).then(
      ([usersRes, orgsRes, agentsRes]) => {
        if (cancelled) return;
        if (usersRes.status === "fulfilled") setUsers(usersRes.value.data.data);
        if (orgsRes.status === "fulfilled") setOrganizations(orgsRes.value.data.data);
        if (agentsRes.status === "fulfilled") setAgents(agentsRes.value.data.data);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const applyPage = (
    response: Awaited<ReturnType<typeof getAuditLogs>>,
    pageToken?: string,
  ) => {
    setEntries((prev) => (pageToken ? [...prev, ...response.data.data] : response.data.data));
    setNextPageToken(response.data.nextPageToken);
    setError("");
  };

  const applyError = (err: unknown, pageToken?: string) => {
    const detail = getApiErrorMessage(err);
    setError(`查詢稽核日誌時發生錯誤${detail ? `：${detail}` : ""}`);
    if (!pageToken) {
      setEntries([]);
      setNextPageToken(undefined);
    }
  };

  const fetchPage = (params: GetAuditLogsParams, pageToken?: string) =>
    getAuditLogs({ ...params, pageToken })
      .then((response) => applyPage(response, pageToken))
      .catch((err) => applyError(err, pageToken))
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });

  // First page with the default filters on open; later queries only run on 「查詢」, since
  // every query spends Cloud Logging read quota and records an auditLogs.queried event.
  useEffect(() => {
    let cancelled = false;
    getAuditLogs(appliedParams)
      .then((response) => !cancelled && applyPage(response))
      .catch((err) => !cancelled && applyError(err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleQuery = () => {
    if (filters.from && filters.to && new Date(filters.from) > new Date(filters.to)) {
      setError("開始時間不可晚於結束時間");
      return;
    }
    const params = toParams(filters);
    setAppliedParams(params);
    setLoading(true);
    fetchPage(params);
  };

  const handleLoadMore = () => {
    if (!nextPageToken) return;
    setLoadingMore(true);
    fetchPage(appliedParams, nextPageToken);
  };

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const orgsById = useMemo(
    () => new Map(organizations.map((o) => [o.id, o])),
    [organizations],
  );
  const agentsById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  const actorLabel = (entry: AuditLogEntry): string => {
    const user = entry.userId ? usersById.get(entry.userId) : undefined;
    return user?.name || entry.userEmail || "—";
  };

  // Whoever/whatever was acted on, most specific first.
  const targetLabel = (entry: AuditLogEntry): string => {
    const targetUserId = propertyString(entry, "targetUserId");
    const targetEmail = propertyString(entry, "targetEmail");
    if (targetEmail || targetUserId) {
      const user = targetUserId ? usersById.get(targetUserId) : undefined;
      return user?.name ?? targetEmail ?? targetUserId!;
    }
    const agentId = propertyString(entry, "agentId");
    const agentCode = propertyString(entry, "agentCode");
    if (agentCode || agentId) {
      return `服務代理 ${agentCode ?? (agentId && agentsById.get(agentId)?.code) ?? agentId}`;
    }
    const serviceCode = propertyString(entry, "serviceCode");
    if (serviceCode) return `服務 ${serviceCode}`;
    const organizationId = propertyString(entry, "organizationId");
    const organizationCode = propertyString(entry, "organizationCode");
    if (organizationId || organizationCode) {
      const org = organizationId ? orgsById.get(organizationId) : undefined;
      return `組織 ${org?.name ?? organizationCode ?? organizationId}`;
    }
    return entry.resource || "—";
  };

  const userOptions = [
    { value: "", label: "全部" },
    ...users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` })),
  ];

  return (
    <>
      <PageHeader
        title="稽核日誌"
        description="查詢登入、權限與管理操作等稽核事件（保留期限約 30 天）"
      />

      <div className="cf-card mb-4 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Input
              id="audit-from"
              label="開始時間"
              type="datetime-local"
              value={filters.from}
              onChange={(e) => update("from", e.target.value)}
            />
          </div>
          <div>
            <Input
              id="audit-to"
              label="結束時間（留空表示至今）"
              type="datetime-local"
              value={filters.to}
              onChange={(e) => update("to", e.target.value)}
            />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-3">
          {QUICK_RANGES.map((r) => (
            <button
              key={r.hours}
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, from: hoursAgoLocal(r.hours), to: "" }))}
              className="cf-link text-xs"
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <CheckboxGroup
              label="事件類別（未勾選表示全部）"
              options={AUDIT_EVENT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
              values={filters.categories}
              onChange={(values) => update("categories", values)}
            />
          </div>
          <div>
            <Select
              label="最低等級"
              value={filters.minSeverity}
              onChange={(e) => update("minSeverity", e.target.value)}
              options={SEVERITY_OPTIONS}
            />
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.hideAuditQueries}
                onChange={(e) => update("hideAuditQueries", e.target.checked)}
                className="h-4 w-4 rounded border-[#d9d9d9]"
              />
              隱藏「查詢稽核日誌」事件
            </label>
          </div>
          <div>
            <Select
              label="操作者"
              value={filters.userId}
              onChange={(e) => update("userId", e.target.value)}
              options={userOptions}
            />
            <Input
              label="操作者 Email"
              value={filters.userEmail}
              onChange={(e) => update("userEmail", e.target.value)}
              placeholder="可查已刪除或不存在的帳號"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="cf-link mt-4 text-sm"
        >
          {showAdvanced ? "收合進階篩選" : "進階篩選"}
        </button>
        {showAdvanced && (
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <Select
                label="對象使用者"
                value={filters.targetUserId}
                onChange={(e) => update("targetUserId", e.target.value)}
                options={userOptions}
              />
            </div>
            <div>
              <Select
                label="組織"
                value={filters.organizationId}
                onChange={(e) => update("organizationId", e.target.value)}
                options={[
                  { value: "", label: "全部" },
                  ...organizations.map((o) => ({ value: o.id, label: `${o.name} (${o.code})` })),
                ]}
              />
            </div>
            <div>
              <Select
                label="服務代理"
                value={filters.agentId}
                onChange={(e) => update("agentId", e.target.value)}
                options={[
                  { value: "", label: "全部" },
                  ...agents.map((a) => ({ value: a.id, label: `${a.name} (${a.code})` })),
                ]}
              />
            </div>
            <div>
              <Input
                label="IP"
                value={filters.clientIp}
                onChange={(e) => update("clientIp", e.target.value)}
                placeholder="例如：203.0.113.5"
              />
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setFilters(defaultFilters())}>
            清除
          </Button>
          <Button onClick={handleQuery} disabled={loading}>
            {loading ? "查詢中…" : "查詢"}
          </Button>
        </div>
      </div>

      {error && <div className="cf-alert cf-alert--error mb-4">{error}</div>}

      {loading ? (
        <LoadingState />
      ) : entries.length === 0 ? (
        !error && <EmptyState message="此條件下沒有稽核事件" />
      ) : (
        <div className="cf-card">
          <p className="px-4 pt-3 text-xs text-slate-500">已載入 {entries.length} 筆（最新在前）</p>
          <table className="cf-table">
            <thead>
              <tr>
                <th className="px-4 py-3 font-medium text-slate-600">時間</th>
                <th className="px-4 py-3 font-medium text-slate-600">等級</th>
                <th className="px-4 py-3 font-medium text-slate-600">事件</th>
                <th className="px-4 py-3 font-medium text-slate-600">操作者</th>
                <th className="px-4 py-3 font-medium text-slate-600">對象</th>
                <th className="px-4 py-3 font-medium text-slate-600">IP</th>
                <th className="px-4 py-3 font-medium text-slate-600">說明</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.insertId}
                  onClick={() => setSelected(entry)}
                  className={`cursor-pointer hover:bg-slate-50 ${
                    isWarningOrAbove(entry.severity) ? "bg-amber-50/60" : ""
                  }`}
                >
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatDisplayTime(entry.timestamp)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${severityBadgeClass(entry.severity)}`}
                    >
                      {entry.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-900">{auditEventLabel(entry.eventType)}</div>
                    {entry.eventType && (
                      <div className="font-mono text-xs text-slate-400">{entry.eventType}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{actorLabel(entry)}</td>
                  <td className="px-4 py-3 text-slate-600">{targetLabel(entry)}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{entry.clientIp || "—"}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-slate-600" title={entry.description ?? ""}>
                    {entry.description || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-slate-100 px-4 py-3 text-center">
            {nextPageToken ? (
              <Button variant="secondary" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? "載入中…" : "載入更多"}
              </Button>
            ) : (
              <p className="text-xs text-slate-400">已無更多資料</p>
            )}
          </div>
        </div>
      )}

      <AuditLogDetailModal
        entry={selected}
        actorLabel={selected ? actorLabel(selected) : undefined}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
