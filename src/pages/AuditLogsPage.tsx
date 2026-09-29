import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getAgents, getAuditLogs, getOrganizations, getUsers } from "../api";
import type { GetAuditLogsParams } from "../api";
import { getApiErrorMessage } from "../api/api";
import { AuditLogDetailModal } from "../components/AuditLogDetailModal";
import { FilterBar, type FilterFieldGroup } from "../components/FilterBar";
import { Button, EmptyState, LoadingState, PageHeader } from "../components/ui";
import {
  AUDIT_EVENT_CATEGORIES,
  auditEventLabel,
  isWarningOrAbove,
  severityBadgeClass,
} from "../lib/auditLog";
import {
  AUDIT_SEVERITY_OPTIONS,
  AUDIT_TIME_PRESETS,
  SINGLE_VALUE_AUDIT_FIELDS,
  auditFiltersFromSearchParams,
  auditFiltersToSearchParams,
  buildAuditLogParams,
  type AuditFilterField,
  type AuditLogFilters,
} from "../lib/auditLogFilters";
import { formatDisplayTime } from "../lib/datetime";
import type { Agent, AuditLogEntry, Organization, User } from "../types";

const PAGE_SIZE = 50;


function propertyString(entry: AuditLogEntry, key: string): string | undefined {
  const value = entry.properties[key];
  return typeof value === "string" && value ? value : undefined;
}

export function AuditLogsPage() {
  // Filters live in the query string (shareable, same scheme as the feedback overview). Read once
  // on mount; every change writes it back and queries right away.
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<AuditLogFilters>(() =>
    auditFiltersFromSearchParams(searchParams),
  );

  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  // The params of the query currently on screen, so "載入更多" keeps paging the same query
  // even if the filter form has been edited since.
  const [appliedParams, setAppliedParams] = useState<GetAuditLogsParams>(() =>
    buildAuditLogParams(filters, PAGE_SIZE),
  );
  // Filters apply on every change, so responses can arrive out of order; only the latest counts.
  const requestSeq = useRef(0);
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

  const fetchPage = (params: GetAuditLogsParams, pageToken?: string) => {
    const seq = ++requestSeq.current;
    return getAuditLogs({ ...params, pageToken })
      .then((response) => seq === requestSeq.current && applyPage(response, pageToken))
      .catch((err) => seq === requestSeq.current && applyError(err, pageToken))
      .finally(() => {
        if (seq !== requestSeq.current) return;
        setLoading(false);
        setLoadingMore(false);
      });
  };

  // First page on open (filters from the URL or the defaults). Note every query spends Cloud
  // Logging read quota and records an auditLogs.queried event.
  useEffect(() => {
    let cancelled = false;
    const seq = ++requestSeq.current;
    const current = () => !cancelled && seq === requestSeq.current;
    getAuditLogs(appliedParams)
      .then((response) => current() && applyPage(response))
      .catch((err) => current() && applyError(err))
      .finally(() => current() && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = (next: AuditLogFilters) => {
    const params = buildAuditLogParams(next, PAGE_SIZE);
    setFilters(next);
    setAppliedParams(params);
    setSearchParams(auditFiltersToSearchParams(next), { replace: true });
    setLoading(true);
    fetchPage(params);
  };

  const handleLoadMore = () => {
    if (!nextPageToken) return;
    setLoadingMore(true);
    fetchPage(appliedParams, nextPageToken);
  };

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

  const userOptions = users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }));
  const single = (field: AuditFilterField) => SINGLE_VALUE_AUDIT_FIELDS.includes(field);
  const fieldGroups: FilterFieldGroup<AuditFilterField>[] = [
    {
      label: "事件",
      fields: [
        {
          value: "category",
          label: "事件類別",
          options: AUDIT_EVENT_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
        },
        { value: "minSeverity", label: "最低等級", options: AUDIT_SEVERITY_OPTIONS, single: single("minSeverity") },
      ],
    },
    {
      label: "操作者",
      fields: [
        { value: "userId", label: "操作者", options: userOptions },
        { value: "userEmail", label: "操作者 Email", placeholder: "可查已刪除或不存在的帳號" },
        { value: "clientIp", label: "IP", placeholder: "例如：203.0.113.5" },
      ],
    },
    {
      label: "對象",
      fields: [
        { value: "targetUserId", label: "對象使用者", options: userOptions },
        {
          value: "organizationId",
          label: "組織",
          options: organizations.map((o) => ({ value: o.id, label: `${o.name} (${o.code})` })),
        },
        {
          value: "agentId",
          label: "服務代理",
          options: agents.map((a) => ({ value: a.id, label: `${a.name} (${a.code})` })),
        },
      ],
    },
  ];

  return (
    <>
      <PageHeader
        title="稽核日誌"
        description="查詢登入、權限與管理操作等稽核事件（保留期限約 30 天）"
      />

      <div className="cf-card mb-4">
        <FilterBar
          value={filters}
          onChange={(next) => applyFilters({ ...filters, ...next })}
          presets={AUDIT_TIME_PRESETS}
          customKey="custom"
          fieldGroups={fieldGroups}
          extra={
            <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.hideAuditQueries}
                onChange={(e) => applyFilters({ ...filters, hideAuditQueries: e.target.checked })}
                className="h-4 w-4 rounded border-[#d9d9d9]"
              />
              隱藏「查詢稽核日誌」事件
            </label>
          }
        />
      </div>

      {error && <div className="cf-alert cf-alert--error mb-4">{error}</div>}

      {loading ? (
        <LoadingState />
      ) : entries.length === 0 ? (
        !error && <EmptyState message="此條件下沒有稽核事件" />
      ) : (
        <div className="cf-card">
          <p className="px-4 pt-3 text-xs text-slate-500">已載入 {entries.length} 筆（最新在前）</p>
          <div className="cf-table-scroll">
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
          </div>
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
