import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Agent, Organization, Service } from "../types";
import {
  createOrganization,
  createService,
  deleteOrganization,
  deleteService,
  getAgents,
  getOrganizations,
  getServices,
  updateOrganization,
  updateService,
} from "../api";
import { getApiErrorMessage } from "../api/api";
import { AgentDetailPanel } from "../components/AgentDetailPanel";
import { Modal } from "../components/Modal";
import { OrganizationServiceTable } from "../components/OrganizationServiceTable";
import { ServiceSdkModal } from "../components/ServiceSdkModal";
import { Button, EmptyState, Input, LoadingState, PageHeader, Select } from "../components/ui";

/** Admin: organizations (create/edit/delete) with each one's services nested underneath. */
export function ServicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // ?code=X (e.g. from the agents page) opens straight onto that service.
  const [codeFilter, setCodeFilter] = useState(searchParams.get("code") ?? "");

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [initiallyExpanded, setInitiallyExpanded] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [servicesRefreshKey, setServicesRefreshKey] = useState(0);

  const [sdkService, setSdkService] = useState<Service | null>(null);

  // Organization modal
  const [orgModalOpen, setOrgModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [orgName, setOrgName] = useState("");
  const [orgCode, setOrgCode] = useState("");
  const [orgError, setOrgError] = useState("");

  // Service modal
  const [svcModalOpen, setSvcModalOpen] = useState(false);
  const [editingSvc, setEditingSvc] = useState<Service | null>(null);
  const [svcOrgId, setSvcOrgId] = useState("");
  const [svcName, setSvcName] = useState("");
  const [svcAgentId, setSvcAgentId] = useState("");
  const [svcCode, setSvcCode] = useState("");
  const [svcHost, setSvcHost] = useState("");
  const [svcError, setSvcError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getOrganizations({ IsActive: true }),
      getAgents(),
      codeFilter ? getServices({ code: codeFilter }) : Promise.resolve(null),
    ])
      .then(([orgs, agentsRes, linked]) => {
        if (cancelled) return;
        setOrganizations(orgs.data.data);
        setAgents(agentsRes.data.data);
        // Every organization starts expanded; a ?code= deep link opens just the one it points at.
        setInitiallyExpanded(
          linked
            ? [...new Set(linked.data.data.map((s) => s.organizationId))]
            : orgs.data.data.map((o) => o.id),
        );
        setLoadError("");
      })
      .catch((error) => {
        if (cancelled) return;
        const detail = getApiErrorMessage(error);
        setLoadError(`載入組織資料時發生錯誤${detail ? `：${detail}` : ""}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // codeFilter is only read for the initial deep link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const reloadOrganizations = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const clearCodeFilter = () => {
    setCodeFilter("");
    setSearchParams({});
  };

  const agentsOfOrg = (orgId: string) => agents.filter((a) => a.organizationId === orgId);

  // ---- Organizations ----
  const openCreateOrg = () => {
    setEditingOrg(null);
    setOrgName("");
    setOrgCode("");
    setOrgError("");
    setOrgModalOpen(true);
  };

  const openEditOrg = (org: Organization) => {
    setEditingOrg(org);
    setOrgName(org.name);
    setOrgCode(org.code);
    setOrgError("");
    setOrgModalOpen(true);
  };

  const handleSaveOrg = async () => {
    if (!orgName.trim()) {
      setOrgError("請輸入組織名稱");
      return;
    }
    if (!orgCode.trim()) {
      setOrgError("請輸入組織代碼");
      return;
    }
    const payload = { name: orgName.trim(), code: orgCode.trim().toUpperCase() };
    try {
      if (editingOrg) {
        await updateOrganization(editingOrg.id, payload);
      } else {
        await createOrganization(payload);
      }
    } catch (error) {
      const detail = getApiErrorMessage(error);
      setOrgError(`${editingOrg ? "更新" : "新增"}組織時發生錯誤${detail ? `：${detail}` : ""}`);
      return;
    }
    setOrgModalOpen(false);
    reloadOrganizations();
  };

  const handleDeleteOrg = async (org: Organization) => {
    if (!confirm(`確定要刪除組織「${org.name}」？`)) return;
    try {
      await deleteOrganization(org.id);
    } catch (error) {
      const detail = getApiErrorMessage(error);
      alert(`刪除組織時發生錯誤${detail ? `：${detail}` : ""}`);
      return;
    }
    reloadOrganizations();
  };

  // ---- Services ----
  const openCreateService = (orgId: string) => {
    setEditingSvc(null);
    setSvcOrgId(orgId);
    setSvcName("");
    setSvcCode("");
    setSvcHost("");
    setSvcAgentId(agentsOfOrg(orgId)[0]?.id ?? "");
    setSvcError("");
    setSvcModalOpen(true);
  };

  const openEditService = (svc: Service) => {
    setEditingSvc(svc);
    setSvcOrgId(svc.organizationId);
    setSvcName(svc.name);
    setSvcCode(svc.code);
    setSvcHost(svc.host);
    setSvcAgentId(svc.agentId);
    setSvcError("");
    setSvcModalOpen(true);
  };

  const handleSaveService = async () => {
    if (!svcName.trim()) {
      setSvcError("請輸入服務名稱");
      return;
    }
    if (!svcAgentId) {
      setSvcError("請選擇所屬服務代理");
      return;
    }
    if (!svcCode.trim()) {
      setSvcError("請輸入服務代碼");
      return;
    }
    if (!svcHost.trim()) {
      setSvcError("請輸入網域");
      return;
    }
    const payload = {
      agentId: svcAgentId,
      name: svcName.trim(),
      code: svcCode.trim().toUpperCase(),
      host: svcHost.trim().toLowerCase(),
    };
    try {
      if (editingSvc) {
        await updateService(editingSvc.id, payload);
      } else {
        await createService(payload);
      }
    } catch (error) {
      const detail = getApiErrorMessage(error);
      setSvcError(`${editingSvc ? "更新" : "新增"}服務時發生錯誤${detail ? `：${detail}` : ""}`);
      return;
    }
    setSvcModalOpen(false);
    setServicesRefreshKey((k) => k + 1);
  };

  const handleDeleteService = async (svc: Service) => {
    if (!confirm(`確定要刪除服務「${svc.name}」？`)) return;
    try {
      await deleteService(svc.id);
    } catch (error) {
      const detail = getApiErrorMessage(error);
      alert(`刪除服務時發生錯誤${detail ? `：${detail}` : ""}`);
      return;
    }
    setServicesRefreshKey((k) => k + 1);
  };

  const svcOrgAgents = agentsOfOrg(svcOrgId);

  return (
    <>
      <PageHeader
        title="服務管理"
        description="管理組織，以及各組織服務代理下的服務項目"
        action={<Button onClick={openCreateOrg}>新增組織</Button>}
      />

      {loadError && (
        <div className="cf-alert cf-alert--error mb-4 flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <button type="button" onClick={reloadOrganizations} className="cf-link shrink-0">
            重試
          </button>
        </div>
      )}

      {codeFilter && (
        <div className="mb-4">
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
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : organizations.length === 0 ? (
        <EmptyState message="尚無組織資料，點擊「新增組織」開始建立" />
      ) : (
        <div className="cf-card">
          <OrganizationServiceTable
            // Remount when the organization list reloads, so a deep link's expansion applies.
            key={reloadKey}
            organizations={organizations}
            loadServices={(orgId) => getServices({ organizationId: orgId }).then((r) => r.data.data)}
            refreshKey={servicesRefreshKey}
            initiallyExpanded={initiallyExpanded}
            serviceFilter={
              codeFilter ? (s) => s.code.toLowerCase() === codeFilter.toLowerCase() : undefined
            }
            orgActions={(org) => (
              <>
                <button type="button" onClick={() => openEditOrg(org)} className="cf-link mr-3">
                  編輯
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteOrg(org)}
                  className="text-red-600 hover:text-red-800"
                >
                  刪除
                </button>
              </>
            )}
            renderOrgToolbar={(org) => (
              <div className="flex items-center justify-between gap-3">
                {agentsOfOrg(org.id).length === 0 ? (
                  <p className="text-sm text-slate-500">
                    此組織尚無服務代理，請先至「服務代理」頁建立，才能新增服務。
                  </p>
                ) : (
                  <h3 className="text-sm font-semibold text-slate-800">{org.name} 的服務</h3>
                )}
                <button
                  type="button"
                  onClick={() => openCreateService(org.id)}
                  disabled={agentsOfOrg(org.id).length === 0}
                  // Primary but smaller than the page-level 新增組織, since it acts on one org.
                  className="cf-btn cf-btn--primary h-7 px-3! py-0! text-xs! disabled:opacity-40"
                >
                  ＋新增服務
                </button>
              </div>
            )}
            serviceActions={(svc, { detailOpen, toggleDetail }) => (
              <>
                <button
                  type="button"
                  onClick={toggleDetail}
                  disabled={!svc.agentId}
                  className="cf-link mr-3 disabled:opacity-40"
                >
                  {detailOpen ? "收合代理資料" : "服務代理詳情"}
                </button>
                <button
                  type="button"
                  onClick={() => setSdkService(svc)}
                  disabled={!svc.agentId}
                  className="cf-link mr-3 disabled:opacity-40"
                >
                  SDK
                </button>
                <button type="button" onClick={() => openEditService(svc)} className="cf-link mr-3">
                  編輯
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteService(svc)}
                  className="text-red-600 hover:text-red-800"
                >
                  刪除
                </button>
              </>
            )}
            renderServiceDetail={(svc) => (
              <AgentDetailPanel
                agentId={svc.agentId}
                organizations={organizations}
                serviceId={svc.id}
                linkToAgentsPage
              />
            )}
          />
        </div>
      )}

      <ServiceSdkModal service={sdkService} onClose={() => setSdkService(null)} />

      <Modal
        open={orgModalOpen}
        title={editingOrg ? "編輯組織" : "新增組織"}
        onClose={() => setOrgModalOpen(false)}
      >
        <div className="space-y-4">
          {orgError && <div className="cf-alert cf-alert--error">{orgError}</div>}
          <Input label="組織名稱" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
          <Input
            label="組織代碼"
            value={orgCode}
            onChange={(e) => setOrgCode(e.target.value)}
            placeholder="例如：NICS"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOrgModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveOrg}>儲存</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={svcModalOpen}
        title={editingSvc ? "編輯服務" : "新增服務"}
        onClose={() => setSvcModalOpen(false)}
      >
        <div className="space-y-4">
          {svcError && <div className="cf-alert cf-alert--error">{svcError}</div>}
          <p className="text-sm text-slate-600">
            所屬組織：{organizations.find((o) => o.id === svcOrgId)?.name ?? "—"}
          </p>
          <Input label="服務名稱" value={svcName} onChange={(e) => setSvcName(e.target.value)} />
          <Select
            label="所屬服務代理"
            value={svcAgentId}
            onChange={(e) => setSvcAgentId(e.target.value)}
            options={[
              { value: "", label: "請選擇服務代理" },
              ...svcOrgAgents.map((a) => ({ value: a.id, label: `${a.name} (${a.code})` })),
            ]}
          />
          <Input
            label="服務代碼"
            value={svcCode}
            onChange={(e) => setSvcCode(e.target.value)}
            placeholder="例如：CHATBOT"
          />
          <Input
            label="網域"
            value={svcHost}
            onChange={(e) => setSvcHost(e.target.value)}
            placeholder="例如：feedback.example.com"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setSvcModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveService}>儲存</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
