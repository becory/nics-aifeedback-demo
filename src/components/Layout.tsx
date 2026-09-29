import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import {
  ServiceIcon,
  UserIcon,
  AgentIcon,
  ListIcon,
  OverviewIcon,
  ScoreIcon,
  ImportIcon,
  AuditIcon,
} from "./NavIcons";

const adminNavItems = [
  { to: "/agents", label: "服務代理", Icon: AgentIcon },
  { to: "/services", label: "服務管理", Icon: ServiceIcon },
  { to: "/users", label: "使用者管理", Icon: UserIcon },
  { to: "/scores", label: "分數管理", Icon: ScoreIcon },
  { to: "/audit-logs", label: "稽核日誌", Icon: AuditIcon },
];

const userNavItems = [
  { to: "/feedback-overview", label: "回饋資料總覽", Icon: OverviewIcon },
  { to: "/import", label: "資料匯入", Icon: ImportIcon },
  { to: "/my-services", label: "服務清單", Icon: ListIcon },
];

function NavSection({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: typeof adminNavItems;
  onNavigate?: () => void;
}) {
  return (
    <div className="cf-nav-section">
      <p className="cf-nav-section__title">{title}</p>
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `cf-nav-link${isActive ? " cf-nav-link--active" : ""}`
            }
          >
            <item.Icon className="h-[18px] w-[18px] shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate("/login");
  };

  const initials = user?.name?.slice(0, 1) ?? "U";

  return (
    <div className="cf-topbar__account" ref={menuRef}>
      <button
        type="button"
        className="cf-account-btn"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="cf-account-avatar" aria-hidden>
          {initials}
        </span>
        <span className="cf-account-name">{user?.name}</span>
      </button>

      {open && (
        <div className="cf-account-menu" role="menu">
          <div className="cf-account-menu__header">
            <p className="cf-account-menu__name">{user?.name}</p>
            <p className="cf-account-menu__email">{user?.email}</p>
            {user?.isSystemAdmin && (
              <span className="cf-account-menu__badge">管理員</span>
            )}
          </div>
          <NavLink
            to="/security-settings"
            role="menuitem"
            className="cf-account-menu__item"
            onClick={() => setOpen(false)}
          >
            安全性設定
          </NavLink>
          <button
            type="button"
            role="menuitem"
            className="cf-account-menu__item cf-account-menu__item--danger"
            onClick={handleLogout}
          >
            登出
          </button>
        </div>
      )}
    </div>
  );
}

function MenuIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
    </svg>
  );
}

export function Layout() {
  const { user } = useAuth();
  const location = useLocation();
  // Mobile only (< md): the sidebar is an off-canvas drawer. On desktop it is always shown and
  // this flag has no visual effect.
  const [navOpen, setNavOpen] = useState(false);
  const [lastPath, setLastPath] = useState(location.pathname);

  // Close the drawer whenever the route changes (e.g. browser back), adjusting state during
  // render rather than in an effect.
  if (location.pathname !== lastPath) {
    setLastPath(location.pathname);
    setNavOpen(false);
  }

  useEffect(() => {
    if (!navOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [navOpen]);

  const closeNav = () => setNavOpen(false);

  return (
    <div className="cf-shell">
      {navOpen && <div className="cf-sidebar-backdrop" onClick={closeNav} aria-hidden />}
      <aside id="cf-sidebar" className={`cf-sidebar${navOpen ? " cf-sidebar--open" : ""}`}>
        <div className="cf-sidebar__brand">
          <h1 className="cf-sidebar__brand-title">AI 回饋系統</h1>
        </div>

        <nav className="cf-sidebar__nav">
          <NavSection title="使用者功能" items={userNavItems} onNavigate={closeNav} />
          {user?.isSystemAdmin && (
            <NavSection title="管理員功能" items={adminNavItems} onNavigate={closeNav} />
          )}
        </nav>
      </aside>

      <div className="cf-main">
        <header className="cf-topbar">
          <div className="cf-topbar__start">
            <button
              type="button"
              className="cf-topbar__menu-btn"
              aria-label={navOpen ? "關閉選單" : "開啟選單"}
              aria-expanded={navOpen}
              aria-controls="cf-sidebar"
              onClick={() => setNavOpen((v) => !v)}
            >
              <MenuIcon />
            </button>
            <span className="cf-topbar__brand">AI 回饋系統</span>
          </div>
          <AccountMenu />
        </header>

        <main className="cf-content">
          <div className="cf-content__inner">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
