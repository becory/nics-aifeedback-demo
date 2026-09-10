import { useEffect, useState } from "react";
import { getOrganizations } from "../api";
import { getApiErrorMessage } from "../api/api";
import type { Organization } from "../types";
import { EmptyState, LoadingState, PageHeader } from "../components/ui";

export function MyOrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const orgs = await getOrganizations({ IsActive: true, currentUser: true });
      setOrganizations(orgs.data.data);
      setLoadError("");
    } catch (error) {
      const detail = getApiErrorMessage(error);
      setLoadError(`載入組織資料時發生錯誤${detail ? `：${detail}` : ""}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <>
      <PageHeader title="組織清單" description="檢視您所屬的組織（僅供查閱）" />

      {loadError && (
        <div className="cf-alert cf-alert--error mb-4 flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <button type="button" onClick={refresh} className="cf-link shrink-0">
            重試
          </button>
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : organizations.length === 0 ? (
        <EmptyState message="您尚未被指派至任何組織" />
      ) : (
        <div className="cf-card">
          <table className="cf-table">
            <thead>
              <tr>
                <th className="px-4 py-3 font-medium text-slate-600">
                  組織名稱
                </th>
                <th className="px-4 py-3 font-medium text-slate-600">
                  組織代碼
                </th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((org) => (
                <tr key={org.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {org.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">
                    {org.code}
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
