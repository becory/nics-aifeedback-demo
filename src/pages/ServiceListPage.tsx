import { Fragment, useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { getAgents, getOrganizations, getServices } from "../api";
import { getApiErrorMessage } from "../api/api";
import type { Agent, Organization, Service } from "../types";
import { AgentDetailPanel } from "../components/AgentDetailPanel";
import { EmptyState, LoadingState, PageHeader, Select } from "../components/ui";

export function ServiceListPage() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [agentFilter, setAgentFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!user) return;

    const refresh = async () => {
      setLoading(true);
      try {
        const [orgs, agentsRes, svcs] = await Promise.all([
          getOrganizations({ currentUser: true }),
          getAgents({ currentUser: true }),
          getServices(
            agentFilter
              ? { currentUser: true, agentId: agentFilter }
              : { currentUser: true },
          ),
        ]);
        setOrganizations(orgs.data.data);
        setAgents(agentsRes.data.data);
        setServices(svcs.data.data);
        setLoadError("");
      } catch (error) {
        const detail = getApiErrorMessage(error);
        setLoadError(`載入服務資料時發生錯誤${detail ? `：${detail}` : ""}`);
      } finally {
        setLoading(false);
      }
    };

    refresh();
  }, [user, agentFilter]);

  return (
    <>
      <PageHeader
        title="服務清單"
        description="檢視您所屬組織的服務（僅供查閱）"
      />

      {loadError && (
        <div className="cf-alert cf-alert--error mb-4">{loadError}</div>
      )}

      {agents.length > 0 && (
        <div className="mb-4 max-w-xs">
          <Select
            label="篩選代理"
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            options={[
              { value: "", label: "全部代理" },
              ...agents.map((a) => ({ value: a.id, label: `${a.name} (${a.code})` })),
            ]}
          />
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : !organizations.length ? (
        <EmptyState message="您尚未被指派至任何組織，無法檢視服務" />
      ) : services.length === 0 ? (
        <EmptyState message="您所屬的組織目前尚無服務" />
      ) : (
        <div className="cf-card">
          <table className="cf-table">
            <thead>
              <tr>
                <th className="px-4 py-3 font-medium text-slate-600">
                  服務名稱
                </th>
                <th className="px-4 py-3 font-medium text-slate-600">
                  所屬組織
                </th>
                <th className="px-4 py-3 font-medium text-slate-600">
                  所屬代理
                </th>
                <th className="px-4 py-3 font-medium text-slate-600">
                  服務代碼
                </th>
                <th className="px-4 py-3 font-medium text-slate-600">網域</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-right">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => (
                <Fragment key={svc.id}>
                  <tr>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {svc.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {svc.organizationName || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {svc.agentId
                        ? `${svc.agentName} (${svc.agentCode})`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {svc.code}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {svc.host || "—"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(expandedId === svc.id ? null : svc.id)
                        }
                        disabled={!svc.agentId}
                        className="cf-link disabled:opacity-40"
                      >
                        {expandedId === svc.id ? "收合代理資料" : "服務代理詳情"}
                      </button>
                    </td>
                  </tr>
                  {expandedId === svc.id && (
                    <tr>
                      <td colSpan={6} className="bg-slate-50 px-4 py-4">
                        <AgentDetailPanel
                          agentId={svc.agentId}
                          organizations={organizations}
                        />
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
