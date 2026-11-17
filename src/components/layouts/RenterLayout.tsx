import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Home, Wrench, MoreHorizontal, Users,
  Building2, Settings, LogOut, X, Search,
} from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import atimanLogo from '@/assets/atiman-logo.png'

const SIDEBAR_GLASS = {
  background: 'rgba(255,255,255,0.18)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  borderRight: '1px solid rgba(255,255,255,0.38)',
}

const HEADER_GLASS = {
  background: 'rgba(255,255,255,0.2)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  borderBottom: '1px solid rgba(255,255,255,0.35)',
}

const bottomTabs = [
  { to: '/renter', icon: Home, label: 'Home', end: true },
  { to: '/renter/requests', icon: Wrench, label: 'Maintenance' },
  { to: '/renter/visitors', icon: Users, label: 'Visitors' },
  { to: '/renter/more', icon: MoreHorizontal, label: 'More' },
]

const sidebarItems = [
  { to: '/renter',             icon: Home,     label: 'Home',           end: true },
  { to: '/renter/requests',    icon: Wrench,   label: 'Maintenance'               },
  { to: '/renter/visitors',    icon: Users,    label: 'Visitors'                  },
  { to: '/renter/lost-found',  icon: Search,   label: 'Lost & Found'              },
  { to: '/renter/rooms',       icon: Building2,label: 'Available Rooms'           },
]

function SidebarNavItem({ to, icon: Icon, label, end, count }: { to: string; icon: React.ElementType; label: string; end?: boolean; count?: number }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-[14px] transition-all duration-200 ${
          isActive ? 'text-[#6C5CE7] font-semibold' : 'text-slate-500 hover:text-slate-700 font-medium'
        }`
      }
      style={({ isActive }) => isActive ? {
        background: 'rgba(108,92,231,0.12)',
        border: '1px solid rgba(108,92,231,0.18)',
      } : {}}
    >
      <Icon size={18} />
      <span className="flex-1">{label}</span>
      {(count ?? 0) > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center leading-none flex-shrink-0"
          style={{ boxShadow: '0 0 0 2px rgba(255,255,255,0.7)' }}>
          {count! > 99 ? '99+' : count}
        </span>
      )}
    </NavLink>
  )
}

function MoreSheet({ onClose }: { onClose: () => void }) {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  const extras = [
    { to: '/renter/lost-found', icon: Search,    label: 'Lost & Found'    },
    { to: '/renter/rooms',      icon: Building2, label: 'Available Rooms' },
    { to: '/renter/settings',   icon: Settings,  label: 'Settings'        },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full rounded-t-2xl shadow-xl p-6 pb-10"
        style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.5)' }}>
        <div className="w-10 h-1 rounded-full mx-auto mb-6" style={{ background: 'rgba(0,0,0,0.12)' }} />
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 transition-colors"
          style={{ background: 'rgba(255,255,255,0.3)' }}>
          <X size={20} />
        </button>
        <div className="space-y-1">
          {extras.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#1e1b4b] text-[14px] font-medium transition-colors"
              style={{ ':hover': { background: 'rgba(255,255,255,0.4)' } } as any}
            >
              <item.icon size={18} className="text-slate-400" />
              <span className="flex-1">{item.label}</span>
            </NavLink>
          ))}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 text-[14px] font-medium w-full transition-colors"
          >
            <LogOut size={18} />
            Log Out
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RenterLayout() {
  const { profile } = useAuth()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [showMore, setShowMore] = useState(false)

  // Per-tab unread notification counts
  const [countHome, setCountHome]         = useState(0)
  const [countMaintenance, setCountMaint] = useState(0)
  const [countVisitors, setCountVisitors] = useState(0)
  const [countLostFound, setCountLF]      = useState(0)

  const fetchCounts = useCallback(async () => {
    if (!profile?.id) return
    const { data } = await supabase
      .from('notifications')
      .select('notification_type')
      .eq('user_id', profile.id)
      .eq('is_read', false)
    const rows = data ?? []
    setCountHome(rows.filter(r => ['rent_reminder','rent_overdue','payment_confirmed','payment_rejected','electricity_reminder','electricity','electricity_paid'].includes(r.notification_type)).length)
    setCountMaint(rows.filter(r => r.notification_type === 'maintenance_update').length)
    setCountVisitors(rows.filter(r => ['visitor_approved','visitor_rejected'].includes(r.notification_type)).length)
    setCountLF(rows.filter(r => ['lost_found','lost_found_claim','lost_found_accepted','lost_found_rejected'].includes(r.notification_type)).length)
  }, [profile?.id])

  const fetchCountsRef = useRef(fetchCounts)
  useEffect(() => { fetchCountsRef.current = fetchCounts }, [fetchCounts])
  useEffect(() => { fetchCounts() }, [fetchCounts])
  useEffect(() => {
    if (!profile?.id) return
    const ch = supabase
      .channel('renter-nav-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => fetchCountsRef.current())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile?.id])

  const navCounts: Record<string, number> = {
    '/renter':            countHome,
    '/renter/requests':   countMaintenance,
    '/renter/visitors':   countVisitors,
    '/renter/lost-found': countLostFound,
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 left-0 z-30" style={SIDEBAR_GLASS}>
        <div className="flex flex-col h-full">
          <div className="px-5 py-6 flex items-center gap-2.5">
            <img src={atimanLogo} alt="ATIMAN" className="h-7 w-auto object-contain flex-shrink-0" />
            <span className="text-[20px] font-bold tracking-tight text-[#1e1b4b]">ATIMAN</span>
          </div>

          <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
            {sidebarItems.map((item) => (
              <SidebarNavItem key={item.to} {...item} count={navCounts[item.to] ?? 0} />
            ))}
          </nav>

          <div className="px-3 py-3 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.3)' }}>
            <NavLink
              to="/renter/settings"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-[14px] transition-all duration-200 ${
                  isActive ? 'text-[#6C5CE7] font-semibold' : 'text-slate-500 hover:text-slate-700 font-medium'
                }`
              }
              style={({ isActive }) => isActive ? {
                background: 'rgba(108,92,231,0.12)',
                border: '1px solid rgba(108,92,231,0.18)',
              } : {}}
            >
              <Settings size={18} />
              <span>Settings</span>
            </NavLink>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-[14px] text-slate-400 hover:text-red-500 font-medium w-full transition-all duration-200"
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,59,48,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <LogOut size={18} />
              <span>Log Out</span>
            </button>

            <div className="flex items-center gap-3 px-4 pt-2.5 pb-1">
              <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-white text-sm font-semibold shrink-0 flex-shrink-0"
                style={{ background: 'rgba(52,199,89,0.8)', boxShadow: '0 2px 8px rgba(52,199,89,0.3)' }}>
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : profile?.full_name?.[0]?.toUpperCase() ?? 'R'}
              </div>
              <div className="overflow-hidden">
                <p className="text-[13px] font-semibold text-[#1e1b4b] truncate">{profile?.full_name}</p>
                <p className="text-[11px] text-slate-400">Renter</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen pb-20 lg:pb-0">
        {/* Desktop header */}
        <header className="hidden lg:flex px-8 py-4 items-center sticky top-0 z-20" style={HEADER_GLASS}>
          <span className="text-[14px] text-slate-500">{profile?.full_name}</span>
        </header>

        {/* Mobile header */}
        <header className="lg:hidden px-4 py-4 flex items-center justify-between sticky top-0 z-20" style={HEADER_GLASS}>
          <div className="flex items-center gap-2">
            <img src={atimanLogo} alt="ATIMAN" className="h-6 w-auto object-contain" />
            <span className="text-[17px] font-bold tracking-tight text-[#1e1b4b]">ATIMAN</span>
          </div>
          <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
            style={{ background: 'rgba(52,199,89,0.85)' }}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              : profile?.full_name?.[0]?.toUpperCase() ?? 'R'}
          </div>
        </header>

        <main className="flex-1 p-4 pb-24 sm:pb-6 sm:p-6 lg:p-8 xl:p-10 max-w-[1440px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 flex"
        style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,0.5)' }}>
        {bottomTabs.map((tab) => {
          if (tab.label === 'More') {
            return (
              <button
                key={tab.label}
                onClick={() => setShowMore(true)}
                className="flex-1 flex flex-col items-center justify-center py-2 gap-1 text-slate-400 relative"
              >
                <div className="relative">
                  <tab.icon size={22} />
                </div>
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            )
          }
          const tabCount = navCounts[tab.to] ?? 0
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-2 gap-1 transition-colors ${
                  isActive ? 'text-[#6C5CE7]' : 'text-slate-400'
                }`
              }
            >
              <div className="relative">
                <tab.icon size={22} />
                {tabCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-0.5 bg-red-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center leading-none"
                    style={{ boxShadow: '0 0 0 1.5px rgba(255,255,255,0.9)' }}>
                    {tabCount > 99 ? '99+' : tabCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {showMore && <MoreSheet onClose={() => setShowMore(false)} />}
    </div>
  )
}
