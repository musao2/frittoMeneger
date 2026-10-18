import { NavLink, Outlet } from 'react-router-dom'
import { LuUsers, LuWallet, LuClock, LuLogOut } from 'react-icons/lu'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../context/PermissionsContext'
import Logo from '../components/Logo'

const NAV = [
  { to: '/employees',  label: 'Xodimlar', icon: LuUsers },
  { to: '/salary',     label: 'Oylik',    icon: LuWallet, can: p => p.view_salary || p.pay_salary || p.give_advance },
  { to: '/attendance', label: 'Davomat',  icon: LuClock,  can: p => p.view_attendance },
]

export default function ManagerLayout() {
  const { profile, signOut } = useAuth()
  const { perms } = usePermissions()
  const nav = NAV.filter(n => !n.can || n.can(perms))

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <Logo subtitle="Menejer paneli" />
          <nav className="hidden sm:flex items-center gap-1 ml-6">
            {nav.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link'}>
                <Icon size={18} /> {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden md:block text-sm text-slate-600 truncate max-w-48">{profile?.full_name || profile?.email}</span>
            <button onClick={signOut} className="btn-secondary h-9 px-3" title="Chiqish">
              <LuLogOut size={16} /> <span className="hidden sm:inline">Chiqish</span>
            </button>
          </div>
        </div>
        {/* Telefonda pastki menyu o'rniga tepada tablar */}
        <nav className="sm:hidden grid border-t border-slate-100" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to} to={to}
              className={({ isActive }) => `flex items-center justify-center gap-1.5 h-11 text-sm ${isActive ? 'text-emerald-800 font-medium bg-emerald-50' : 'text-slate-500'}`}
            >
              <Icon size={16} /> {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  )
}
