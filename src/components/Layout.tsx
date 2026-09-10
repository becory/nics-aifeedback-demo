import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import {
  OrgIcon,
  ServiceIcon,
  UserIcon,
  KeyIcon,
  ListIcon,
  OverviewIcon,
  ScoreIcon,
} from "./NavIcons";

const adminNavItems = [
  { to: "/organizations", label: "組織管理", Icon: OrgIcon },
  { to: "/services", label: "服務管理", Icon: ServiceIcon },
  { to: "/offline-keys", label: "離線金鑰", Icon: KeyIcon },
  { to: "/users", label: "使用者管理", Icon: UserIcon },
  { to: "/scores", label: "分數管理", Icon: ScoreIcon },
];

const userNavItems = [
  { to: "/feedback-overview", label: "回饋資料總覽", Icon: OverviewIcon },
  { to: "/my-organizations", label: "組織清單", Icon: OrgIcon },
  { to: "/my-services", label: "服務清單", Icon: ListIcon },
];

function NavSection({
  title,
  items,
}: {
  title: string;
  items: typeof adminNavItems;
}) {
  return (
    <div className="cf-nav-section">
      <p className="cf-nav-section__title">{title}</p>
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
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

export function Layout() {
  const { user } = useAuth();

  return (
    <div className="cf-shell">
      <aside className="cf-sidebar">
        <div className="cf-sidebar__brand">
          <h1 className="cf-sidebar__brand-title">AI 回饋系統</h1>
        </div>

        <nav className="cf-sidebar__nav">
          <NavSection title="使用者功能" items={userNavItems} />
          {user?.isSystemAdmin && (
            <NavSection title="管理員功能" items={adminNavItems} />
          )}
        </nav>
      </aside>

      <div className="cf-main">
        <header className="cf-topbar">
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
