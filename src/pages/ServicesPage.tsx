import { useEffect, useState } from "react";
import { useSubmitGuard } from "../lib/useSubmitGuard";
import { useSearchParams } from "react-router-dom";
import type { Organization, Service } from "../types";
import {
  createOrganization,
  createService,
  deleteOrganization,
  deleteService,
  getOrganizations,
  getServices,
  updateOrganization,
  updateService,
} from "../api";
import { getApiErrorMessage } from "../api/api";
import { Modal } from "../components/Modal";
import { OrganizationKeysModal } from "../components/OrganizationKeysModal";
import { OrganizationServiceTable } from "../components/OrganizationServiceTable";
import { Button, EmptyState, Input, LoadingState, PageHeader, Select } from "../components/ui";

/** Admin: organizations (create/edit/delete) with each one's services nested underneath. */
export function ServicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // ?code=X opens straight onto that service.
  const [codeFilter, setCodeFilter] = useState(searchParams.get("code") ?? "");

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [initiallyExpanded, setInitiallyExpanded] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [servicesRefreshKey, setServicesRefreshKey] = useState(0);

  const [keysOrg, setKeysOrg] = useState<Organization | null>(null);

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
  const [svcCode, setSvcCode] = useState("");
  const [svcHost, setSvcHost] = useState("");
  const [svcError, setSvcError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getOrganizations({ IsActive: true }),
      codeFilter ? getServices({ code: codeFilter }) : Promise.resolve(null),
    ])
      .then(([orgs, linked]) => {
        if (cancelled) return;
        setOrganizations(orgs.data.data);
        // Every organization starts collapsed; a ?code= deep link opens just the one it points at.
        setInitiallyExpanded(linked ? [...new Set(linked.data.data.map((s) => s.organizationId))] : []);
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

  // After a service create/move/delete: refresh the per-org service counts in place, without
  // remounting the table (which would collapse every organization).
  const refreshServiceCounts = () => {
    getOrganizations({ IsActive: true })
      .then((orgs) => setOrganizations(orgs.data.data))
      .catch(() => {
        // Counts stay stale until the next reload; the services themselves are already refreshed.
      });
  };

  const afterServiceChange = () => {
    setServicesRefreshKey((k) => k + 1);
    refreshServiceCounts();
  };

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

  const [savingOrg, guardSaveOrg] = useSubmitGuard();
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
    setSvcError("");
    setSvcModalOpen(true);
  };

  const openEditService = (svc: Service) => {
    setEditingSvc(svc);
    setSvcOrgId(svc.organizationId);
    setSvcName(svc.name);
    setSvcCode(svc.code);
    setSvcHost(svc.host);
    setSvcError("");
    setSvcModalOpen(true);
  };

  const [savingService, guardSaveService] = useSubmitGuard();
  const handleSaveService = async () => {
    if (!svcName.trim()) {
      setSvcError("請輸入服務名稱");
      return;
    }
    if (!svcOrgId) {
      setSvcError("請選擇所屬組織");
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
    if (
      editingSvc &&
      svcOrgId !== editingSvc.organizationId &&
      !confirm(
        `確定要將服務「${editingSvc.name}」移至組織「${orgNameOf(svcOrgId)}」？\n\n` +
          "這個服務所有的回饋資料都會改由新組織檢視，原組織將看不到；過去的匯入紀錄仍留在原組織。",
      )
    ) {
      return;
    }
    const payload = {
      organizationId: svcOrgId,
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
    afterServiceChange();
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
    afterServiceChange();
  };

  const orgNameOf = (orgId: string) => organizations.find((o) => o.id === orgId)?.name ?? "—";

  return (
    <>
      <PageHeader
        title="服務管理"
        description="管理組織、組織下的服務，以及各組織的離線金鑰"
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
                <button type="button" onClick={() => setKeysOrg(org)} className="cf-link mr-3">
                  檢視離線金鑰
                </button>
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
                <h3 className="text-sm font-semibold text-slate-800">{org.name} 的服務</h3>
                <button
                  type="button"
                  onClick={() => openCreateService(org.id)}
                  // Primary but smaller than the page-level 新增組織, since it acts on one org.
                  className="cf-btn cf-btn--primary h-7 px-3! py-0! text-xs!"
                >
                  ＋新增服務
                </button>
              </div>
            )}
            serviceActions={(svc) => (
              <>
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
          />
        </div>
      )}

      <OrganizationKeysModal organization={keysOrg} onClose={() => setKeysOrg(null)} />

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
            <Button onClick={() => guardSaveOrg(handleSaveOrg)} disabled={savingOrg}>
              {savingOrg ? "儲存中…" : "儲存"}
            </Button>
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
          <Select
            label="所屬組織"
            value={svcOrgId}
            onChange={(e) => setSvcOrgId(e.target.value)}
            options={organizations.map((o) => ({ value: o.id, label: `${o.name} (${o.code})` }))}
          />
          {editingSvc && svcOrgId !== editingSvc.organizationId && (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-700">
              變更所屬組織後，這個服務所有的回饋資料都會改由新組織檢視，原組織將看不到；過去的匯入紀錄仍留在原組織。
            </p>
          )}
          <Input label="服務名稱" value={svcName} onChange={(e) => setSvcName(e.target.value)} />
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
            <Button onClick={() => guardSaveService(handleSaveService)} disabled={savingService}>
              {savingService ? "儲存中…" : "儲存"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
