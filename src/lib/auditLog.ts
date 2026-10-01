// Display helpers for the audit log page. Event types and property keys come from the
// backend's audit events (aifeedback-portal docs/superpowers/specs/2026-09-27-audit-events-design.md);
// anything not listed here is shown as its raw value.

export const AUDIT_EVENT_LABELS: Record<string, string> = {
  "auth.login_succeeded": "登入成功",
  "auth.login_failed": "登入失敗",
  "auth.account_locked": "帳號鎖定",
  "auth.password_changed": "變更密碼",
  "auth.password_change_failed": "變更密碼失敗",
  "auth.2fa_enrolled": "啟用雙因素驗證",
  "auth.2fa_reset": "重設雙因素驗證",
  "auth.2fa_reset_failed": "重設雙因素驗證失敗",
  "user.created": "新增使用者",
  "user.updated": "更新使用者",
  "user.deleted": "刪除使用者",
  "user.password_reset": "管理員重設密碼",
  "user.2fa_reset": "管理員重設雙因素驗證",
  "user.org_access_granted": "授予組織權限",
  "user.org_access_revoked": "撤銷組織權限",
  "organization.created": "新增組織",
  "organization.updated": "更新組織",
  "organization.deactivated": "停用組織",
  "organization.restored": "恢復組織",
  // agent.* / sdkSettings.* are no longer emitted; kept so older events in retention still read well.
  "agent.created": "新增服務代理",
  "agent.updated": "更新服務代理",
  "agent.deactivated": "停用服務代理",
  "agent.key_rotated": "輪替金鑰",
  "agent.key_revoked": "撤銷金鑰",
  "agent.env_downloaded": "下載 .env",
  "organizationKey.created": "新增離線金鑰",
  "organizationKey.updated": "修改離線金鑰說明",
  "organizationKey.revoked": "撤銷離線金鑰",
  "organizationKey.env_generated": "產生離線金鑰 .env",
  "service.created": "新增服務",
  "service.updated": "更新服務",
  "service.deactivated": "停用服務",
  "service.restored": "恢復服務",
  "import.completed": "匯入完成",
  "import.rejected": "匯入遭拒",
  "import.error": "匯入錯誤",
  "scoreConfig.updated": "更新分數設定",
  "sdkSettings.updated": "更新 SDK 設定",
  "system.unhandled_exception": "系統未處理例外",
  "auditLogs.queried": "查詢稽核日誌",
};

/** Each category is sent as one or more eventType prefix filters ("auth.*"). */
export const AUDIT_EVENT_CATEGORIES: { value: string; label: string; prefixes: string[] }[] = [
  { value: "auth", label: "認證", prefixes: ["auth.*"] },
  { value: "user", label: "使用者", prefixes: ["user.*"] },
  { value: "organization", label: "組織", prefixes: ["organization.*"] },
  { value: "organizationKey", label: "離線金鑰", prefixes: ["organizationKey.*"] },
  { value: "service", label: "服務", prefixes: ["service.*"] },
  { value: "import", label: "匯入", prefixes: ["import.*"] },
  { value: "settings", label: "設定", prefixes: ["scoreConfig.*"] },
  { value: "system", label: "系統", prefixes: ["system.*"] },
];

export const AUDIT_QUERY_EVENT_TYPE = "auditLogs.queried";

export const AUDIT_PROPERTY_LABELS: Record<string, string> = {
  targetUserId: "對象使用者 ID",
  targetEmail: "對象 Email",
  attemptedEmail: "嘗試登入的 Email",
  organizationId: "組織 ID",
  organizationCode: "組織代碼",
  organizationIds: "組織 ID 清單",
  grantedOrganizationIds: "授予的組織",
  revokedOrganizationIds: "撤銷的組織",
  agentId: "服務代理 ID",
  agentCode: "服務代理代碼",
  previousAgentId: "原服務代理 ID",
  previousOrganizationId: "原組織 ID",
  keyId: "金鑰 UUID",
  serviceIds: "服務 ID 清單",
  serviceId: "服務 ID",
  serviceCode: "服務代碼",
  scoreConfigId: "分數設定 ID",
  changedFields: "變更欄位",
  isSystemAdmin: "系統管理員",
  isSystemAdminBefore: "變更前系統管理員",
  isSystemAdminAfter: "變更後系統管理員",
  wasSystemAdmin: "原為系統管理員",
  deploymentType: "部署類型",
  keyGenerationId: "金鑰世代 ID",
  keyPreview: "金鑰預覽",
  expiresAt: "到期時間",
  lockoutEnd: "鎖定至",
  reason: "原因",
  factor: "驗證因素",
  importLogId: "匯入紀錄 ID",
  stage: "階段",
  status: "狀態",
  totalRecordCount: "總筆數",
  succeededRecordCount: "成功筆數",
  failedRecordCount: "失敗筆數",
  duplicateRecordCount: "重複筆數",
  dataRangeStart: "資料起始",
  dataRangeEnd: "資料結束",
  errorMessage: "錯誤訊息",
  exceptionType: "例外類型",
  cloudSdkScriptUrl: "雲端 SDK 載入網址",
  httpMethod: "HTTP 方法",
  path: "路徑",
  pageSize: "每頁筆數",
  traceId: "Trace ID",
  TraceId: "Trace ID",
  RequestId: "Request ID",
};

/** Shown separately (collapsible code block) rather than in the key/value table. */
export const AUDIT_STACK_TRACE_KEY = "stack_trace";

export function auditEventLabel(eventType: string | null | undefined): string {
  if (!eventType) return "—";
  return AUDIT_EVENT_LABELS[eventType] ?? eventType;
}

const SEVERITY_RANK: Record<string, number> = {
  DEFAULT: 0,
  DEBUG: 100,
  INFO: 200,
  NOTICE: 300,
  WARNING: 400,
  ERROR: 500,
  CRITICAL: 600,
  ALERT: 700,
  EMERGENCY: 800,
};

export function isWarningOrAbove(severity: string): boolean {
  return (SEVERITY_RANK[severity] ?? 0) >= SEVERITY_RANK.WARNING;
}

export function severityBadgeClass(severity: string): string {
  const rank = SEVERITY_RANK[severity] ?? 0;
  if (rank >= SEVERITY_RANK.ERROR) return "bg-red-100 text-red-700";
  if (rank >= SEVERITY_RANK.WARNING) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}
