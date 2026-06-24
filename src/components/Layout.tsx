import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { OrgIcon, ServiceIcon, UserIcon, KeyIcon, ListIcon, OverviewIcon, ScoreIcon } from './NavIcons'

const adminNavItems = [
  { to: '/organizations', label: '組織管理', Icon: OrgIcon },
  { to: '/services', label: '服務管理', Icon: ServiceIcon },
  { to: '/offline-keys', label: '離線金鑰', Icon: KeyIcon },
  { to: '/users', label: '使用者管理', Icon: UserIcon },
  { to: '/scores', label: '分數管理', Icon: ScoreIcon },
]

const userNavItems = [
  { to: '/feedback-overview', label: '總覽', Icon: OverviewIcon },
  { to: '/my-services', label: '服務清單', Icon: ListIcon },
]

function NavSection({
  title,
  items,
}: {
  title: string
  items: typeof adminNavItems
}) {
  return (
    <div>
      <p className="mb-2 px-3 text-xs font-semibold text-slate-500">{title}</p>
      <div className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <item.Icon />
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-5">
          <h1 className="text-lg font-bold text-slate-900">AI 回饋系統</h1>
          <p className="mt-1 text-xs text-slate-500">管理後台</p>
        </div>

        <nav className="flex-1 space-y-6 p-4">
          <NavSection title="使用者功能" items={userNavItems} />
          {user?.isAdmin && <NavSection title="管理員功能" items={adminNavItems} />}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-sm font-medium text-slate-900">{user?.nameZh}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
            {user?.isAdmin && (
              <span className="mt-1 inline-block rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
                管理員
              </span>
            )}
          </div>
          <NavLink
            to="/change-password"
            className={({ isActive }) =>
              `mb-2 block w-full rounded-lg border px-3 py-2 text-center text-sm font-medium transition-colors ${
                isActive
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            修改密碼
          </NavLink>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            登出
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-[#f2f2f2]">
        <div className="mx-auto max-w-[1400px] px-5 py-5">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
