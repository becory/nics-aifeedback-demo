import { useEffect, useState } from "react";
import { formatDisplayTime } from "../lib/datetime";
import {
  AUDIT_PROPERTY_LABELS,
  AUDIT_STACK_TRACE_KEY,
  auditEventLabel,
  formatAuditValue,
  severityBadgeClass,
} from "../lib/auditLog";
import type { AuditLogEntry } from "../types";
import { Modal } from "./Modal";

interface AuditLogDetailModalProps {
  /** The entry to show; null keeps the modal closed. */
  entry: AuditLogEntry | null;
  /** Display name for the acting user (resolved by the page from its user list). */
  actorLabel?: string;
  onClose: () => void;
}

export function AuditLogDetailModal({ entry, actorLabel, onClose }: AuditLogDetailModalProps) {
  return (
    <Modal open={!!entry} title="稽核事件詳情" onClose={onClose} wide>
      {/* Keyed so the stack trace / copied state resets per entry. */}
      {entry && <AuditLogDetail key={entry.insertId} entry={entry} actorLabel={actorLabel} />}
    </Modal>
  );
}

function AuditLogDetail({ entry, actorLabel }: { entry: AuditLogEntry; actorLabel?: string }) {
  const [showStackTrace, setShowStackTrace] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const stackTrace = entry.properties[AUDIT_STACK_TRACE_KEY];
  const properties = Object.entries(entry.properties).filter(
    ([key]) => key !== AUDIT_STACK_TRACE_KEY,
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
      setCopied(true);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <p>
          <span className="text-slate-500">時間：</span>
          {formatDisplayTime(entry.timestamp)}
        </p>
        <p>
          <span className="text-slate-500">等級：</span>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${severityBadgeClass(entry.severity)}`}
          >
            {entry.severity}
          </span>
        </p>
        <p>
          <span className="text-slate-500">事件：</span>
          {auditEventLabel(entry.eventType)}
          {entry.eventType && (
            <span className="ml-1 font-mono text-xs text-slate-400">{entry.eventType}</span>
          )}
        </p>
        <p>
          <span className="text-slate-500">操作者：</span>
          {actorLabel || entry.userEmail || "—"}
          {actorLabel && entry.userEmail && actorLabel !== entry.userEmail && (
            <span className="ml-1 text-xs text-slate-400">{entry.userEmail}</span>
          )}
        </p>
        <p>
          <span className="text-slate-500">IP：</span>
          <span className="font-mono">{entry.clientIp || "—"}</span>
        </p>
        <p>
          <span className="text-slate-500">資源：</span>
          <span className="font-mono">{entry.resource || "—"}</span>
        </p>
        <p className="sm:col-span-2">
          <span className="text-slate-500">說明：</span>
          {entry.description || "—"}
        </p>
        <p className="sm:col-span-2 text-xs text-slate-400">
          Insert ID：<span className="font-mono">{entry.insertId}</span>
          {entry.userId && (
            <>
              ，操作者 ID：<span className="font-mono">{entry.userId}</span>
            </>
          )}
        </p>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">事件屬性</p>
        {properties.length === 0 ? (
          <p className="text-sm text-slate-400">無</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {properties.map(([key, value]) => (
                <tr key={key} className="border-t border-slate-100 align-top">
                  <td className="w-44 py-1.5 pr-4 text-slate-500">
                    {AUDIT_PROPERTY_LABELS[key] ?? key}
                    {AUDIT_PROPERTY_LABELS[key] && (
                      <div className="font-mono text-[11px] text-slate-400">{key}</div>
                    )}
                  </td>
                  <td className="whitespace-pre-wrap break-all py-1.5 font-mono text-xs text-slate-700">
                    {formatAuditValue(value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {stackTrace !== undefined && stackTrace !== null && (
        <div>
          <button
            type="button"
            onClick={() => setShowStackTrace((v) => !v)}
            className="cf-link text-xs"
          >
            {showStackTrace ? "隱藏 Stack trace" : "顯示 Stack trace"}
          </button>
          {showStackTrace && (
            <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-slate-900 px-4 py-3 text-xs leading-relaxed text-slate-100">
              <code>{formatAuditValue(stackTrace)}</code>
            </pre>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={handleCopy} className="cf-link text-xs">
          {copied ? "已複製" : "複製 JSON"}
        </button>
      </div>
    </div>
  );
}
