import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { getOrganizations, getServices } from "../api";
import type { Organization, Service } from "../types";
import { EmptyState, PageHeader } from "../components/ui";

export function ServiceListPage() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    if (!user) return;
    getOrganizations().then((res) =>
      setOrganizations(
        res.data.data.filter((o) => user.organizationIds.includes(o.id)),
      ),
    );
    getServices().then((res) =>
      setServices(
        res.data.data.filter((s) =>
          user.organizationIds.includes(s.organizationId),
        ),
      ),
    );
  }, [user]);

  const getOrgName = (orgId: string) =>
    organizations.find((o) => o.id === orgId)?.name ?? "—";

  return (
    <>
      <PageHeader
        title="服務清單"
        description="檢視您所屬組織的服務（僅供查閱）"
      />

      {!user?.organizationIds.length ? (
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
