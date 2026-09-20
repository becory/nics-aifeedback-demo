import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAgentById } from "../api";
import { getApiErrorMessage } from "../api/api";
import { formatDisplayTime } from "../lib/datetime";
import type { Agent, Organization } from "../types";
import { LoadingState } from "./ui";

function isAgentExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

interface AgentDetailPanelProps {
  agentId: string;
  organizations: Organization[];
  /** Deep-links to the "服務代理" management page, filtered to this service — admin only. */
  serviceId?: string;
  linkToAgentsPage?: boolean;
}

export function AgentDetailPanel({
  agentId,
  organizations,
  serviceId,
  linkToAgentsPage = false,
}: AgentDetailPanelProps) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setAgent(null);

    getAgentById(agentId)
      .then((response) => {
        if (!cancelled) setAgent(response.data);
      })
      .catch((err) => {
        if (!cancelled) {
          const detail = getApiErrorMessage(err);
          setError(`載入服務代理詳情時發生錯誤${detail ? `：${detail}` : ""}`);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agentId]);

  if (loading) return <LoadingState />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!agent) return null;

  const orgName = organizations.find((o) => o.id === agent.organizationId)?.name ?? "—";
  const currentKey = agent.keys[0];

  return (
    <>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        <p>
          <span className="text-slate-500">代理名稱：</span>
          {agent.name}
        </p>
        <p>
          <span className="text-slate-500">代理代碼：</span>
          <span className="font-mono">{agent.code}</span>
        </p>
        <p>
          <span className="text-slate-500">所屬組織：</span>
          {orgName}
        </p>
        <p>
          <span className="text-slate-500">說明：</span>
          {agent.description || "—"}
        </p>
        <p>
          <span className="text-slate-500">金鑰到期時間：</span>
          {formatDisplayTime(currentKey.expiresAt)}
        </p>
        <p>
          <span className="text-slate-500">狀態：</span>
          {!agent.isActive
            ? "已停用"
            : isAgentExpired(currentKey.expiresAt)
              ? "已過期"
              : "有效"}
        </p>
        <p>
          <span className="text-slate-500">使用中金鑰數：</span>
          {agent.activeKeysCount}
        </p>
        <p>
          <span className="text-slate-500">金鑰預覽：</span>
          <span className="font-mono">{agent.aesKeyPreview}</span>
        </p>
      </div>
      {linkToAgentsPage && serviceId && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            金鑰輪替、撤銷與 .env 下載請至「服務代理」頁面操作。
          </p>
          <Link to={`/agents?serviceId=${serviceId}`} className="cf-link shrink-0 text-xs">
            前往服務代理頁面 →
          </Link>
        </div>
      )}
    </>
  );
}
