import { Fragment, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Agent, Organization, Service } from "../types";
import {
  createAgent,
  deleteAgent,
  downloadAgentEnv,
  getAgents,
  getOrganizations,
  getServices,
  revokeAgentKey,
  rotateAgentKey,
  updateAgent,
} from "../api";
import { getApiErrorMessage } from "../api/api";
import { formatDisplayTime } from "../lib/datetime";
import { Modal } from "../components/Modal";
import {
  Button,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from "../components/ui";

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultExpiresAt(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return toDatetimeLocal(d.toISOString());
}

function formatDateTime(iso: string): string {
  return formatDisplayTime(iso);
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

export function AgentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Agent[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceFilter, setServiceFilter] = useState(searchParams.get("serviceId") ?? "");
  const [orgFilter, setOrgFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [organizationId, setOrganizationId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [revealKey, setRevealKey] = useState<{ agentName: string; aesKey: string } | null>(null);

  const [rotatingAgent, setRotatingAgent] = useState<Agent | null>(null);
  const [rotateExpiresAt, setRotateExpiresAt] = useState("");
  const [rotateError, setRotateError] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const [agents, orgs, svcs] = await Promise.all([
        getAgents({
          ...(serviceFilter ? { serviceId: serviceFilter } : {}),
          ...(orgFilter ? { organizationId: orgFilter } : {}),
        }),
        getOrganizations({ IsActive: true }),
        getServices(),
      ]);
      setItems(agents.data.data);
      setOrganizations(orgs.data.data);
      setServices(svcs.data.data);
      setLoadError("");
    } catch (error) {
      const detail = getApiErrorMessage(error);
      setLoadError(`載入服務代理資料時發生錯誤${detail ? `：${detail}` : ""}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceFilter, orgFilter]);

  const getOrgName = (orgId: string) =>
    organizations.find((o) => o.id === orgId)?.name ?? "—";

  const getServicesForAgent = (agentId: string) =>
    services.filter((s) => s.agentId === agentId);

  const openCreate = () => {
    setEditing(null);
    setOrganizationId(organizations[0]?.id ?? "");
    setCode("");
    setName("");
    setDescription("");
    setExpiresAt(defaultExpiresAt());
    setError("");
    setModalOpen(true);
  };

  const openEdit = (agent: Agent) => {
    setEditing(agent);
    setOrganizationId(agent.organizationId);
    setCode(agent.code);
    setName(agent.name);
    setDescription(agent.description ?? "");
    setError("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!organizationId) {
      setError("請選擇所屬組織");
      return;
    }
    if (!code.trim()) {
      setError("請輸入代理代碼");
      return;
    }
    if (!name.trim()) {
      setError("請輸入代理名稱");
      return;
    }
    if (!editing && !expiresAt) {
      setError("請設定金鑰到期時間");
      return;
    }

    try {
      if (editing) {
        await updateAgent(editing.id, {
          name: name.trim(),
          description: description.trim() || undefined,
        });
      } else {
        const expiresAtIso = new Date(expiresAt).toISOString();
        if (new Date(expiresAtIso).getTime() <= Date.now()) {
          setError("到期時間必須晚於現在");
          return;
        }

        const created = await createAgent({
          organizationId,
          code: code.trim().toUpperCase(),
          name: name.trim(),
          description: description.trim() || undefined,
          expiresAt: expiresAtIso,
        });
        if (created.data.aesKey) {
          setRevealKey({ agentName: created.data.name, aesKey: created.data.aesKey });
        }
      }
    } catch (error) {
      const detail = getApiErrorMessage(error);
      setError(
        `${editing ? "更新" : "新增"}服務代理時發生錯誤${detail ? `：${detail}` : ""}`,
      );
      return;
    }

    refresh();
    setModalOpen(false);
  };

  const handleDeactivate = async (agent: Agent) => {
    if (!confirm(`確定要停用服務代理「${agent.name}」？停用後無法復原。`)) return;

    try {
      await deleteAgent(agent.id);
    } catch (error) {
      const detail = getApiErrorMessage(error);
      alert(`停用服務代理時發生錯誤${detail ? `：${detail}` : ""}`);
      return;
    }

    refresh();
  };

  const openRotateKey = (agent: Agent) => {
    setRotatingAgent(agent);
    setRotateExpiresAt(defaultExpiresAt());
    setRotateError("");
  };

  const confirmRotateKey = async () => {
    if (!rotatingAgent) return;
    if (!rotateExpiresAt) {
      setRotateError("請設定新金鑰到期時間");
      return;
    }

    const expiresAtIso = new Date(rotateExpiresAt).toISOString();
    if (new Date(expiresAtIso).getTime() <= Date.now()) {
      setRotateError("到期時間必須晚於現在");
      return;
    }

    try {
      const rotated = await rotateAgentKey(rotatingAgent.id, expiresAtIso);
      if (rotated.data.aesKey) {
        setRevealKey({ agentName: rotated.data.name, aesKey: rotated.data.aesKey });
      }
    } catch (error) {
      const detail = getApiErrorMessage(error);
      setRotateError(`輪替金鑰時發生錯誤${detail ? `：${detail}` : ""}`);
      return;
    }

    setRotatingAgent(null);
    refresh();
  };

  const handleRevokeKey = async (agent: Agent, keyId: string) => {
    if (!confirm("確定要撤銷此金鑰？撤銷後無法復原。")) return;

    try {
      await revokeAgentKey(agent.id, keyId);
    } catch (error) {
      const detail = getApiErrorMessage(error);
      alert(`撤銷金鑰時發生錯誤${detail ? `：${detail}` : ""}`);
      return;
    }

    refresh();
  };

  const handleDownloadEnv = async (agent: Agent) => {
    try {
      const response = await downloadAgentEnv(agent.id);
      const url = URL.createObjectURL(response.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${agent.code}.env`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      const detail = getApiErrorMessage(error);
      alert(`下載 .env 檔案時發生錯誤${detail ? `：${detail}` : ""}`);
    }
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore
    }
  };

  return (
    <>
      <PageHeader
        title="服務代理"
        description="管理各組織的服務代理，供部署端下載 .env 設定檔"
        action={
          <Button onClick={openCreate} disabled={organizations.length === 0}>
            新增服務代理
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

      <div className="mb-4 flex flex-wrap gap-4">
        <div className="max-w-xs flex-1">
          <Select
            label="篩選組織"
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            options={[
              { value: "", label: "全部組織" },
              ...organizations.map((o) => ({ value: o.id, label: `${o.name} (${o.code})` })),
            ]}
          />
        </div>
        <div className="max-w-xs flex-1">
          <Select
            label="篩選服務"
            value={serviceFilter}
            onChange={(e) => {
              const value = e.target.value;
              setServiceFilter(value);
              setSearchParams(value ? { serviceId: value } : {});
            }}
            options={[
              { value: "", label: "全部服務" },
              ...services.map((s) => ({ value: s.id, label: `${s.code} - ${s.name}` })),
            ]}
          />
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : organizations.length === 0 ? (
        <EmptyState message="請先建立組織，才能新增服務代理" />
      ) : items.length === 0 ? (
        <EmptyState message="尚無服務代理，點擊「新增服務代理」開始建立" />
      ) : (
        <div className="cf-card">
          <table className="cf-table">
            <thead>
              <tr>
                <th className="px-4 py-3 font-medium text-slate-600">名稱</th>
                <th className="px-4 py-3 font-medium text-slate-600">代碼</th>
                <th className="px-4 py-3 font-medium text-slate-600">
                  所屬組織
                </th>
                <th className="px-4 py-3 font-medium text-slate-600">
                  使用中金鑰數
                </th>
                <th className="px-4 py-3 font-medium text-slate-600">
                  金鑰到期時間
                </th>
                <th className="px-4 py-3 font-medium text-slate-600">狀態</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-right">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((agent) => {
                const currentKey = agent.keys[0];
                const expired = isExpired(currentKey.expiresAt);
                return (
                <Fragment key={agent.id}>
                  <tr>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {agent.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {agent.code}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {getOrgName(agent.organizationId)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {agent.activeKeysCount}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDateTime(currentKey.expiresAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          !agent.isActive
                            ? "bg-slate-100 text-slate-600"
                            : expired
                              ? "bg-red-100 text-red-700"
                              : "bg-green-100 text-green-700"
                        }`}
                      >
                        {!agent.isActive ? "已停用" : expired ? "已過期" : "有效"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(expandedId === agent.id ? null : agent.id)
                        }
                        className="cf-link mr-3"
                      >
                        {expandedId === agent.id ? "收合金鑰" : "顯示所有key"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadEnv(agent)}
                        disabled={!agent.isActive}
                        className="cf-link mr-3 disabled:opacity-40"
                      >
                        下載 .env
                      </button>
                      <button
                        type="button"
                        onClick={() => openRotateKey(agent)}
                        disabled={!agent.isActive}
                        className="cf-link mr-3 disabled:opacity-40"
                      >
                        輪替金鑰
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(agent)}
                        className="cf-link mr-3"
                      >
                        編輯
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeactivate(agent)}
                        disabled={!agent.isActive}
                        className="text-red-600 hover:text-red-800 disabled:opacity-40"
                      >
                        停用
                      </button>
                    </td>
                  </tr>
                  {expandedId === agent.id && (
                    <tr>
                      <td colSpan={7} className="bg-slate-50 px-4 py-4">
                        <p className="mb-2 text-xs font-medium text-slate-500">
                          所有金鑰世代（僅新建立或剛輪替的金鑰會顯示完整明文，其餘僅顯示遮罩預覽）
                        </p>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-slate-500">
                              <th className="py-1 pr-4 font-medium">建立時間</th>
                              <th className="py-1 pr-4 font-medium">到期時間</th>
                              <th className="py-1 pr-4 font-medium">金鑰預覽</th>
                              <th className="py-1 pr-4 font-medium">狀態</th>
                              <th className="py-1 font-medium text-right">操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {agent.keys.map((key, idx) => {
                              const isCurrent = idx === 0;
                              return (
                                <tr key={key.id}>
                                  <td className="py-1 pr-4 text-slate-600">
                                    {formatDateTime(key.createdAt)}
                                  </td>
                                  <td className="py-1 pr-4 text-slate-600">
                                    {formatDateTime(key.expiresAt)}
                                  </td>
                                  <td className="py-1 pr-4 font-mono text-slate-600">
                                    {key.aesKeyPreview}
                                  </td>
                                  <td className="py-1 pr-4">
                                    {key.isRevoked ? (
                                      <span className="text-slate-400">
                                        已撤銷
                                        {key.revokedAt
                                          ? `（${formatDateTime(key.revokedAt)}）`
                                          : ""}
                                      </span>
                                    ) : isCurrent ? (
                                      <span className="text-green-700">使用中</span>
                                    ) : (
                                      <span className="text-amber-600">
                                        保留中（可解密舊資料）
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-1 text-right">
                                    {!isCurrent && !key.isRevoked && (
                                      <button
                                        type="button"
                                        onClick={() => handleRevokeKey(agent, key.id)}
                                        className="text-red-600 hover:text-red-800"
                                      >
                                        撤銷
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {getServicesForAgent(agent.id).length > 0 && (
                          <p className="mt-3 text-xs text-slate-500">
                            相關服務：
                            {getServicesForAgent(agent.id).map((s, idx) => (
                              <span key={s.id}>
                                {idx > 0 && "、"}
                                <Link
                                  to={`/services?code=${encodeURIComponent(s.code)}`}
                                  className="cf-link"
                                >
                                  {s.code} ({s.host})
                                </Link>
                              </span>
                            ))}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? "編輯服務代理" : "新增服務代理"}
        onClose={() => setModalOpen(false)}
      >
        <div className="space-y-4">
          {error && <div className="cf-alert cf-alert--error">{error}</div>}
          <Select
            label="所屬組織"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            disabled={!!editing}
            options={organizations.map((o) => ({
              value: o.id,
              label: `${o.name} (${o.code})`,
            }))}
          />
          <Input
            label="代理代碼"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="例如：AGENT01"
            disabled={!!editing}
          />
          <Input
            label="代理名稱"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="說明"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="選填"
          />
          {!editing && (
            <div className="space-y-1.5">
              <label
                htmlFor="expiresAt"
                className="block text-sm font-medium text-slate-700"
              >
                金鑰到期時間
              </label>
              <input
                id="expiresAt"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="cf-input"
              />
            </div>
          )}
          {!editing && (
            <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
              儲存後將自動產生一組 256-bit AES KEY（Base64 編碼），僅此一次顯示明文。
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>儲存</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!rotatingAgent}
        title="輪替金鑰"
        onClose={() => setRotatingAgent(null)}
      >
        {rotatingAgent && (
          <div className="space-y-4">
            {rotateError && (
              <div className="cf-alert cf-alert--error">{rotateError}</div>
            )}
            <p className="text-sm text-slate-600">
              將為「{rotatingAgent.name}」產生新金鑰，請設定新金鑰的到期時間。輪替後請重新下載
              .env 部署代理。
            </p>
            <div className="space-y-1.5">
              <label
                htmlFor="rotateExpiresAt"
                className="block text-sm font-medium text-slate-700"
              >
                新金鑰到期時間
              </label>
              <input
                id="rotateExpiresAt"
                type="datetime-local"
                value={rotateExpiresAt}
                onChange={(e) => setRotateExpiresAt(e.target.value)}
                className="cf-input"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setRotatingAgent(null)}>
                取消
              </Button>
              <Button onClick={confirmRotateKey}>確認輪替</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!revealKey}
        title="金鑰已產生"
        onClose={() => setRevealKey(null)}
      >
        {revealKey && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              「{revealKey.agentName}」的新金鑰僅在此顯示一次，請立即複製並妥善保存，關閉後將無法再次取得明文。
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="flex-1 break-all font-mono text-sm text-slate-700">
                {revealKey.aesKey}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(revealKey.aesKey)}
                className="cf-link shrink-0 text-xs"
              >
                複製
              </button>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setRevealKey(null)}>關閉</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
