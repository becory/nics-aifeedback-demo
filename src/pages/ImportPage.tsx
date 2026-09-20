import { Fragment, useEffect, useState } from "react";
import axios from "axios";
import type { ImportLog, ImportLogDetail, Organization } from "../types";
import {
  getImportLogById,
  getImportLogs,
  getOrganizations,
  importOrganizationData,
} from "../api";
import { getApiErrorMessage } from "../api/api";
import { formatDisplayTime } from "../lib/datetime";
import {
  Button,
  EmptyState,
  LoadingState,
  PageHeader,
  Select,
} from "../components/ui";

const STATUS_LABELS: Record<string, string> = {
  Succeeded: "成功",
  PartiallySucceeded: "部分成功",
  Failed: "失敗",
};

function statusBadgeClass(status: string): string {
  if (status === "Succeeded") return "bg-green-100 text-green-700";
  if (status === "PartiallySucceeded") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function formatDateOnly(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function formatDataRange(log: ImportLog): string {
  if (!log.dataRangeStart || !log.dataRangeEnd) return "—";
  return `${formatDateOnly(log.dataRangeStart)} ~ ${formatDateOnly(log.dataRangeEnd)}`;
}

export function ImportPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadResult, setUploadResult] = useState<ImportLogDetail | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<ImportLogDetail | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [expandedError, setExpandedError] = useState("");

  useEffect(() => {
    getOrganizations({ currentUser: true }).then((res) => {
      setOrganizations(res.data.data);
      setOrganizationId((current) => current || res.data.data[0]?.id || "");
    });
  }, []);

  const refreshLogs = async (orgId: string) => {
    if (!orgId) {
      setLogs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await getImportLogs({ organizationId: orgId });
      setLogs(
        [...res.data.data].sort(
          (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
        ),
      );
      setLoadError("");
    } catch (error) {
      const detail = getApiErrorMessage(error);
      setLoadError(`載入匯入紀錄時發生錯誤${detail ? `：${detail}` : ""}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshLogs(organizationId);
    setExpandedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const lastLog = logs[0] ?? null;

  const handleUpload = async () => {
    if (!organizationId) {
      setUploadError("請選擇組織");
      return;
    }
    if (!file) {
      setUploadError("請選擇要匯入的 .json 檔案");
      return;
    }

    setUploading(true);
    setUploadError("");
    setUploadResult(null);
    try {
      const text = await file.text();
      const envelope = JSON.parse(text);
      const response = await importOrganizationData(organizationId, envelope);
      setUploadResult(response.data);
      setFile(null);
      refreshLogs(organizationId);
    } catch (error) {
      if (error instanceof SyntaxError) {
        setUploadError("檔案不是有效的 JSON 格式");
      } else if (axios.isAxiosError(error) && error.code === "ECONNABORTED") {
        setUploadError(
          "上傳逾時，資料量較大時解密與寫入可能需要較長時間，請稍後再檢查匯入紀錄是否已完成，或重新嘗試",
        );
      } else {
        const detail = getApiErrorMessage(error);
        setUploadError(`匯入時發生錯誤${detail ? `：${detail}` : ""}`);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleToggleDetail = async (log: ImportLog) => {
    if (expandedId === log.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(log.id);
    setExpandedDetail(null);
    setExpandedError("");
    setExpandedLoading(true);
    try {
      const response = await getImportLogById(log.id);
      setExpandedDetail(response.data);
    } catch (error) {
      const detail = getApiErrorMessage(error);
      setExpandedError(`載入匯入詳情時發生錯誤${detail ? `：${detail}` : ""}`);
    } finally {
      setExpandedLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="資料匯入"
        description="上傳部署端匯出的加密回饋資料，匯入至所屬組織"
      />

      <div className="cf-card mb-6 p-4">
        <div className="mb-4 max-w-xs">
          <Select
            label="組織"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            options={organizations.map((o) => ({
              value: o.id,
              label: `${o.name} (${o.code})`,
            }))}
          />
        </div>

        {lastLog && (
          <p className="mb-4 text-xs text-slate-500">
            上次匯入：
            {lastLog.agentName
              ? `${lastLog.agentName} (${lastLog.agentCode})，金鑰 ${lastLog.keyPreview ?? "—"}`
              : "—"}
            ，{formatDisplayTime(lastLog.requestedAt)}
          </p>
        )}

        {uploadError && (
          <div className="cf-alert cf-alert--error mb-4">{uploadError}</div>
        )}
        {uploadResult && (
          <div className="cf-alert mb-4 bg-slate-50">
            <p>
              匯入結果：{STATUS_LABELS[uploadResult.status] ?? uploadResult.status}，
              共 {uploadResult.totalRecordCount} 筆，成功 {uploadResult.succeededRecordCount}，
              失敗 {uploadResult.failedRecordCount}，重複 {uploadResult.duplicateRecordCount}
              {uploadResult.errorMessage ? `，${uploadResult.errorMessage}` : ""}
            </p>
            {uploadResult.serviceSummaries.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
                {uploadResult.serviceSummaries.map((s) => (
                  <li key={s.serviceId}>
                    <span className="font-mono">{s.serviceId}</span>：共 {s.totalCount} 筆，
                    成功 {s.succeededCount}，失敗 {s.failedCount}，重複 {s.duplicateCount}
                    {s.failedReason ? `（失敗原因：${s.failedReason}）` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <input
            id="import-file"
            type="file"
            accept="application/json,.json"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-[#0055dc] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#004bcc]"
          />
          <Button
            onClick={handleUpload}
            disabled={!organizationId || !file || uploading}
          >
            {uploading ? "匯入中…" : "上傳並匯入"}
          </Button>
        </div>
        {file && (
          <p className="mt-2 text-xs text-slate-500">已選擇檔案：{file.name}</p>
        )}
      </div>

      {loadError && (
        <div className="cf-alert cf-alert--error mb-4 flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => refreshLogs(organizationId)}
            className="cf-link shrink-0"
          >
            重試
          </button>
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : !organizationId ? (
        <EmptyState message="您尚未被指派至任何組織，無法匯入資料" />
      ) : logs.length === 0 ? (
        <EmptyState message="尚無匯入紀錄" />
      ) : (
        <div className="cf-card">
          <table className="cf-table">
            <thead>
              <tr>
                <th className="px-4 py-3 font-medium text-slate-600">時間</th>
                <th className="px-4 py-3 font-medium text-slate-600">代理</th>
                <th className="px-4 py-3 font-medium text-slate-600">金鑰</th>
                <th className="px-4 py-3 font-medium text-slate-600">資料範圍</th>
                <th className="px-4 py-3 font-medium text-slate-600">狀態</th>
                <th className="px-4 py-3 font-medium text-slate-600">總筆數</th>
                <th className="px-4 py-3 font-medium text-slate-600">成功</th>
                <th className="px-4 py-3 font-medium text-slate-600">失敗</th>
                <th className="px-4 py-3 font-medium text-slate-600">重複</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-right">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <Fragment key={log.id}>
                  <tr>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDisplayTime(log.requestedAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {log.agentName ? `${log.agentName} (${log.agentCode})` : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {log.keyPreview ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDataRange(log)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(log.status)}`}
                      >
                        {STATUS_LABELS[log.status] ?? log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{log.totalRecordCount}</td>
                    <td className="px-4 py-3 text-slate-600">{log.succeededRecordCount}</td>
                    <td className="px-4 py-3 text-slate-600">{log.failedRecordCount}</td>
                    <td className="px-4 py-3 text-slate-600">{log.duplicateRecordCount}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleDetail(log)}
                        className="cf-link"
                      >
                        {expandedId === log.id ? "收合" : "詳情"}
                      </button>
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr>
                      <td colSpan={10} className="bg-slate-50 px-4 py-4">
                        {expandedLoading ? (
                          <LoadingState />
                        ) : expandedError ? (
                          <p className="text-sm text-red-600">{expandedError}</p>
                        ) : expandedDetail ? (
                          <>
                            {expandedDetail.errorMessage && (
                              <p className="mb-2 text-sm text-red-600">
                                {expandedDetail.errorMessage}
                              </p>
                            )}
                            {expandedDetail.serviceSummaries.length > 0 && (
                              <div className="mb-4">
                                <p className="mb-1 text-xs font-medium text-slate-500">
                                  各服務匯入筆數
                                </p>
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-left text-xs text-slate-500">
                                      <th className="py-1 pr-4 font-medium">服務</th>
                                      <th className="py-1 pr-4 font-medium">總筆數</th>
                                      <th className="py-1 pr-4 font-medium">成功</th>
                                      <th className="py-1 pr-4 font-medium">失敗</th>
                                      <th className="py-1 pr-4 font-medium">重複</th>
                                      <th className="py-1 font-medium">失敗原因</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {expandedDetail.serviceSummaries.map((s) => (
                                      <tr key={s.serviceId}>
                                        <td className="py-1 pr-4 font-mono text-slate-600">
                                          {s.serviceId}
                                        </td>
                                        <td className="py-1 pr-4 text-slate-600">
                                          {s.totalCount}
                                        </td>
                                        <td className="py-1 pr-4 text-slate-600">
                                          {s.succeededCount}
                                        </td>
                                        <td className="py-1 pr-4 text-slate-600">
                                          {s.failedCount}
                                        </td>
                                        <td className="py-1 pr-4 text-slate-600">
                                          {s.duplicateCount}
                                        </td>
                                        <td className="py-1 text-slate-600">
                                          {s.failedReason ?? "—"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            {expandedDetail.failedLineSamples.length === 0 ? (
                              <p className="text-sm text-slate-500">無失敗列細節</p>
                            ) : (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left text-xs text-slate-500">
                                    <th className="py-1 pr-4 font-medium">行號</th>
                                    <th className="py-1 font-medium">原因</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {expandedDetail.failedLineSamples.map((e, idx) => (
                                    <tr key={idx}>
                                      <td className="py-1 pr-4 text-slate-600">
                                        {e.lineNumber}
                                      </td>
                                      <td className="py-1 text-slate-600">{e.reason}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                            <p className="mt-3 text-xs text-slate-400">
                              檔案 MD5：<span className="font-mono">{expandedDetail.fileMd5}</span>
                            </p>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
