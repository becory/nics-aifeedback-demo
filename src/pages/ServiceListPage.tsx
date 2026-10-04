import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { getOrganizations, getServices } from "../api";
import { getApiErrorMessage } from "../api/api";
import type { Organization } from "../types";
import { OrganizationServiceTable } from "../components/OrganizationServiceTable";
import { EmptyState, LoadingState, PageHeader } from "../components/ui";

/** Read-only: the user's organizations, each expanding to its services. */
export function ServiceListPage() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getOrganizations({ currentUser: true })
      .then((res) => {
        if (cancelled) return;
        setOrganizations(res.data.data);
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
  }, [user]);

  return (
    <>
      <PageHeader
        title="服務清單"
        description="檢視您所屬組織與其服務（僅供查閱），展開組織以查看服務"
      />

      {loadError && <div className="cf-alert cf-alert--error mb-4">{loadError}</div>}

      {loading ? (
        <LoadingState />
      ) : organizations.length === 0 ? (
        <EmptyState message="您尚未被指派至任何組織，無法檢視服務" />
      ) : (
        <div className="cf-card">
          <OrganizationServiceTable
            organizations={organizations}
            loadServices={(orgId) =>
              getServices({ currentUser: true, organizationId: orgId }).then((r) => r.data.data)
            }
            emptyServicesMessage="此組織目前尚無服務"
          />
        </div>
      )}
    </>
  );
}
