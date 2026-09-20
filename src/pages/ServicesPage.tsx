import { Fragment, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Agent, Organization, Service } from "../types";
import {
  createService,
  deleteService,
  getAgents,
  getOrganizations,
  getServices,
  updateService,
} from "../api";
import { getApiErrorMessage } from "../api/api";
import { AgentDetailPanel } from "../components/AgentDetailPanel";
import { Modal } from "../components/Modal";
import {
  Button,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from "../components/ui";

export function ServicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Service[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [agentFilter, setAgentFilter] = useState(searchParams.get("agentId") ?? "");
  const [codeFilter, setCodeFilter] = useState(searchParams.get("code") ?? "");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [code, setCode] = useState("");
  const [host, setHost] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const [services, agentsRes, orgsRes] = await Promise.all([
        getServices({
          ...(agentFilter ? { agentId: agentFilter } : {}),
          ...(codeFilter ? { code: codeFilter } : {}),
        }),
        getAgents(),
        getOrganizations(),
      ]);
      setItems(services.data.data);
      setAgents(agentsRes.data.data);
      setOrganizations(orgsRes.data.data);
      setLoadError("");
    } catch (error) {
      const detail = getApiErrorMessage(error);
      setLoadError(`載入服務資料時發生錯誤${detail ? `：${detail}` : ""}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentFilter, codeFilter]);

  const clearCodeFilter = () => {
    setCodeFilter("");
    setSearchParams(agentFilter ? { agentId: agentFilter } : {});
  };

  const getAgent = (id: string) => agents.find((a) => a.id === id);
  const getOrgName = (orgId: string) =>
    organizations.find((o) => o.id === orgId)?.name ?? "—";
  const getAgentLabel = (id: string) => {
    const agent = getAgent(id);
    return agent
      ? `${getOrgName(agent.organizationId)} - ${agent.name} (${agent.code})`
      : "—";
  };

  const openCreate = () => {
    setEditing(null);
    setName("");
    setCode("");
    setHost("");
    setAgentId(agents[0]?.id ?? "");
    setError("");
    setModalOpen(true);
  };

  const openEdit = (svc: Service) => {
    setEditing(svc);
    setName(svc.name);
    setCode(svc.code);
    setHost(svc.host);
    setAgentId(svc.agentId);
    setError("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("請輸入服務名稱");
      return;
    }
    if (!agentId) {
      setError("請選擇所屬服務代理");
      return;
    }
    if (!code.trim()) {
      setError("請輸入服務代碼");
      return;
    }
    if (!host.trim()) {
      setError("請輸入網域");
      return;
    }

    const normalizedCode = code.trim().toUpperCase();
    const normalizedHost = host.trim().toLowerCase();
    const payload = {
      agentId,
      name: name.trim(),
      code: normalizedCode,
      host: normalizedHost,
    };

    try {
      if (editing) {
        await updateService(editing.id, payload);
      } else {
        await createService(payload);
      }
    } catch (error) {
      const detail = getApiErrorMessage(error);
      setError(
        `${editing ? "更新" : "新增"}服務時發生錯誤${detail ? `：${detail}` : ""}`,
      );
      return;
    }

    refresh();
    setModalOpen(false);
  };

  const handleDelete = async (svc: Service) => {
    if (!confirm(`確定要刪除服務「${svc.name}」？`)) return;

    try {
      await deleteService(svc.id);
    } catch (error) {
      const detail = getApiErrorMessage(error);
      alert(`刪除服務時發生錯誤${detail ? `：${detail}` : ""}`);
      return;
    }

    refresh();
  };

  return (
    <>
      <PageHeader
        title="服務管理"
        description="管理各服務代理下的服務項目"
        action={
          <Button onClick={openCreate} disabled={agents.length === 0}>
            新增服務
          </Button>
        }
      />

      {loadError && (
        <div className="cf-alert cf-alert--error mb-4 flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <button type="button" onClick={refresh} className="cf-link shrink-0">
            重試
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="max-w-xs flex-1">
          <Select
            label="篩選代理"
            value={agentFilter}
            onChange={(e) => {
              const value = e.target.value;
              setAgentFilter(value);
              setSearchParams(value ? { agentId: value } : {});
            }}
            options={[
              { value: "", label: "全部代理" },
              ...agents.map((a) => ({ value: a.id, label: getAgentLabel(a.id) })),
            ]}
          />
        </div>
        {codeFilter && (
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 py-1 pl-3 pr-1.5 text-xs text-slate-700">
            僅顯示服務代碼：<span className="font-mono font-medium">{codeFilter}</span>
            <button
              type="button"
              onClick={clearCodeFilter}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-300 text-sm font-bold leading-none text-slate-700 hover:bg-red-500 hover:text-white"
              aria-label="清除服務代碼篩選"
            >
              ✕
            </button>
          </span>
        )}
      </div>

      {loading ? (
        <LoadingState />
      ) : agents.length === 0 ? (
        <EmptyState message="請先建立服務代理，才能新增服務" />
      ) : items.length === 0 ? (
        <EmptyState message="尚無服務資料，點擊「新增服務」開始建立" />
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
              {items.map((svc) => (
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
                        className="cf-link mr-3 disabled:opacity-40"
                      >
                        {expandedId === svc.id ? "收合代理資料" : "服務代理詳情"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(svc)}
                        className="cf-link mr-3"
                      >
                        編輯
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(svc)}
                        className="text-red-600 hover:text-red-800"
                      >
                        刪除
                      </button>
                    </td>
                  </tr>
                  {expandedId === svc.id && (
                    <tr>
                      <td colSpan={6} className="bg-slate-50 px-4 py-4">
                        <AgentDetailPanel
                          agentId={svc.agentId}
                          organizations={organizations}
                          serviceId={svc.id}
                          linkToAgentsPage
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

      <Modal
        open={modalOpen}
        title={editing ? "編輯服務" : "新增服務"}
        onClose={() => setModalOpen(false)}
      >
        <div className="space-y-4">
          {error && <div className="cf-alert cf-alert--error">{error}</div>}
          <Input
            label="服務名稱"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Select
            label="所屬服務代理"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            options={[
              { value: "", label: "請選擇服務代理" },
              ...agents.map((a) => ({
                value: a.id,
                label: getAgentLabel(a.id),
              })),
            ]}
          />
          <Input
            label="服務代碼"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="例如：CHATBOT"
          />
          <Input
            label="網域"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="例如：feedback.example.com"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>儲存</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
