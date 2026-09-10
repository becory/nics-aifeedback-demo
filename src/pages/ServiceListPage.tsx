import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { getOrganizations, getServices } from "../api";
import { getApiErrorMessage } from "../api/api";
import type { Organization, Service } from "../types";
import { EmptyState, LoadingState, PageHeader } from "../components/ui";

export function ServiceListPage() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!user) return;

    const refresh = async () => {
      setLoading(true);
      try {
        const [orgs, svcs] = await Promise.all([
          getOrganizations({ currentUser: true }),
          getServices({ currentUser: true }),
        ]);
        setOrganizations(orgs.data.data);
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
  }, [user]);

  const getOrgName = (orgId: string) =>
    organizations.find((o) => o.id === orgId)?.name ?? "—";

  return (
    <>
      <PageHeader
        title="服務清單"
        description="檢視您所屬組織的服務（僅供查閱）"
      />

      {loadError && (
        <div className="cf-alert cf-alert--error mb-4">{loadError}</div>
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
                  服務代碼
                </th>
                <th className="px-4 py-3 font-medium text-slate-600">網域</th>
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => (
                <tr key={svc.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {svc.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {getOrgName(svc.organizationId)}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">
                    {svc.code}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">
                    {svc.host || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
