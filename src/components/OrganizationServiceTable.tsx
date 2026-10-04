import { useEffect, useRef, useState, type ReactNode } from "react";
import { getApiErrorMessage } from "../api/api";
import type { Organization, Service } from "../types";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 text-[#8c8c8c] transition-transform ${open ? "rotate-90" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path d="M7.21 14.77a.75.75 0 0 1 .02-1.06L10.94 10 7.23 6.29a.75.75 0 1 1 1.06-1.06l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.08-.02Z" />
    </svg>
  );
}

interface OrgServices {
  loading: boolean;
  error: string;
  services: Service[];
}

interface OrganizationServiceTableProps {
  organizations: Organization[];
  /** Loads one organization's services — called when its row is first expanded. */
  loadServices: (organizationId: string) => Promise<Service[]>;
  /** Bump to reload the services of every organization that is currently expanded. */
  refreshKey?: number;
  /** Organizations expanded on mount (e.g. deep-linked to one service). */
  initiallyExpanded?: string[];
  /** Narrows the services shown under each organization (the loaded list is unchanged). */
  serviceFilter?: (service: Service) => boolean;
  orgActions?: (org: Organization) => ReactNode;
  serviceActions?: (service: Service) => ReactNode;
  /** Extra line inside an expanded organization, above its services (e.g. an add button). */
  renderOrgToolbar?: (org: Organization) => ReactNode;
  emptyServicesMessage?: string;
}

/**
 * Organizations as top-level rows; expanding one loads its services (loadServices) into a
 * nested table. Services load lazily per organization, not all up front.
 */
export function OrganizationServiceTable({
  organizations,
  loadServices,
  refreshKey = 0,
  initiallyExpanded = [],
  serviceFilter,
  orgActions,
  serviceActions,
  renderOrgToolbar,
  emptyServicesMessage = "此組織尚無服務",
}: OrganizationServiceTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initiallyExpanded));
  const [byOrg, setByOrg] = useState<Record<string, OrgServices>>(() =>
    Object.fromEntries(initiallyExpanded.map((id) => [id, { loading: true, error: "", services: [] }])),
  );

  const fetchOrg = (orgId: string) =>
    loadServices(orgId)
      .then((services) => setByOrg((prev) => ({ ...prev, [orgId]: { loading: false, error: "", services } })))
      .catch((err) => {
        const detail = getApiErrorMessage(err);
        setByOrg((prev) => ({
          ...prev,
          [orgId]: {
            loading: false,
            error: `載入服務時發生錯誤${detail ? `：${detail}` : ""}`,
            services: prev[orgId]?.services ?? [],
          },
        }));
      });

  // Initially expanded organizations load on mount; later expansions load from the click.
  useEffect(() => {
    initiallyExpanded.forEach(fetchOrg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // refreshKey bumps reload what is on screen (after a create/edit/delete); the current rows
  // stay visible until the new ones arrive.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    expanded.forEach(fetchOrg);
    // Collapsed organizations may be stale too (a service can move into one): drop their cache so
    // they reload when next expanded.
    setByOrg((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => expanded.has(id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const toggleOrg = (orgId: string) => {
    const next = new Set(expanded);
    if (next.has(orgId)) {
      next.delete(orgId);
    } else {
      next.add(orgId);
      if (!byOrg[orgId] || byOrg[orgId].error) {
        setByOrg((prev) => ({ ...prev, [orgId]: { loading: true, error: "", services: [] } }));
        fetchOrg(orgId);
      }
    }
    setExpanded(next);
  };

  const hasOrgActions = !!orgActions;

  return (
    <div className="cf-table-scroll cf-table-scroll--sticky-head">
      <table className="cf-table">
        <thead>
          <tr>
            <th className="w-10" />
            <th className="px-4 py-3 font-medium text-slate-600">組織名稱</th>
            <th className="px-4 py-3 font-medium text-slate-600">組織代碼</th>
            <th className="px-4 py-3 font-medium text-slate-600">服務數量</th>
            {hasOrgActions && <th className="px-4 py-3 text-right font-medium text-slate-600">操作</th>}
          </tr>
        </thead>
        {/* One tbody per organization: its row sticks (below the header) only while its own
            services are on screen, then the next organization pushes it out. */}
        {organizations.map((org) => {
            const open = expanded.has(org.id);
            const state = byOrg[org.id];
            const services = (state?.services ?? []).filter((s) => !serviceFilter || serviceFilter(s));
            return (
              <tbody key={org.id} className="cf-org-section">
                <tr className="cf-org-row cursor-pointer" onClick={() => toggleOrg(org.id)}>
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleOrg(org.id);
                      }}
                      className="rounded p-1 hover:bg-[#ebebeb]"
                      aria-expanded={open}
                      aria-label={open ? `收合 ${org.name}` : `展開 ${org.name} 的服務`}
                    >
                      <ChevronIcon open={open} />
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{org.name}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{org.code}</td>
                  <td className="px-4 py-3 text-slate-600">{org.serviceCount ?? "—"}</td>
                  {hasOrgActions && (
                    <td className="whitespace-nowrap px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {orgActions(org)}
                    </td>
                  )}
                </tr>

                {open && (
                  <tr>
                    <td colSpan={hasOrgActions ? 5 : 4} className="bg-slate-50 px-4 py-3 sm:pl-12">
                      {renderOrgToolbar && <div className="mb-2">{renderOrgToolbar(org)}</div>}
                      {!state || state.loading ? (
                        <p className="py-3 text-sm text-slate-400">載入服務中…</p>
                      ) : state.error ? (
                        <p className="py-3 text-sm text-red-600">
                          {state.error}{" "}
                          <button type="button" className="cf-link" onClick={() => fetchOrg(org.id)}>
                            重試
                          </button>
                        </p>
                      ) : services.length === 0 ? (
                        <p className="py-3 text-sm text-slate-400">{emptyServicesMessage}</p>
                      ) : (
                        <div className="cf-nested-table rounded border border-slate-200 bg-white">
                          {/* No overflow of its own: the outer table area scrolls (both ways), so
                              this header can stick below the outer one. */}
                          <table className="cf-table">
                            <thead>
                              <tr>
                                <th className="px-4 py-2 font-medium text-slate-600">服務名稱</th>
                                <th className="px-4 py-2 font-medium text-slate-600">服務代碼</th>
                                <th className="px-4 py-2 font-medium text-slate-600">網域</th>
                                {serviceActions && (
                                  <th className="px-4 py-2 text-right font-medium text-slate-600">操作</th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {services.map((svc) => (
                                <tr key={svc.id}>
                                  <td className="px-4 py-2 font-medium text-slate-900">{svc.name}</td>
                                  <td className="px-4 py-2 font-mono text-slate-600">{svc.code}</td>
                                  <td className="px-4 py-2 font-mono text-slate-600">{svc.host || "—"}</td>
                                  {serviceActions && (
                                    <td className="whitespace-nowrap px-4 py-2 text-right">{serviceActions(svc)}</td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
      </table>
    </div>
  );
}
