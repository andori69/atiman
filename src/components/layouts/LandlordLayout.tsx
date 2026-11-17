// @ts-nocheck
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, UserCheck, Building2, Zap,
  Wrench, Users, FileText, Megaphone,
  Settings, LogOut, Menu, X, CalendarCheck, Search,
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

const MOBILE_HEADER_GLASS = {
  background: 'rgba(255,255,255,0.2)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  borderBottom: '1px solid rgba(255,255,255,0.35)',
}

export default function LandlordLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Per-tab action-required counts
  const [countRegistrations, setCountRegistrations] = useState(0)
  const [countMaintenance, setCountMaintenance]     = useState(0)
  const [countVisitors, setCountVisitors]           = useState(0)
  const [countPayments, setCountPayments]           = useState(0)
  const [countLostFound, setCountLostFound]         = useState(0)
  // ── Count fetcher ──────────────────────────────────────────────────────────
  // Each query checks ONLY the statuses that require landlord action.
  // Resolved / approved / rejected items are excluded — they never contribute to a dot.
  const fetchCounts = useCallback(async () => {
    if (!profile?.id) return

    // Registrations: only 'pending' — approved/rejected need no action
    const { count: regCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('linked_landlord_id', profile.id)
      .eq('status', 'pending')
    setCountRegistrations(regCount ?? 0)

    // Scope: landlord's buildings → rooms
    const { data: bldgs } = await supabase.from('buildings').select('id').eq('landlord_id', profile.id)
    const bldgIds = (bldgs ?? []).map((b: any) => b.id)
    if (!bldgIds.length) {
      setCountMaintenance(0); setCountVisitors(0); setCountPayments(0); return
    }

    const { data: rooms } = await supabase.from('rooms').select('id').in('building_id', bldgIds)
    const roomIds = (rooms ?? []).map((r: any) => r.id)
    if (!roomIds.length) {
      setCountMaintenance(0); setCountVisitors(0); setCountPayments(0); return
    }

    // Maintenance: only 'pending' — in_progress is already acknowledged
    const { count: mc } = await supabase
      .from('maintenance_requests')
      .select('id', { count: 'exact', head: true })
      .in('room_id', roomIds)
      .eq('status', 'pending')
    setCountMaintenance(mc ?? 0)

    // Scope: active tenants for visitor + payment queries
    const { data: tenants } = await supabase
      .from('tenants').select('id').in('room_id', roomIds).eq('is_active', true)
    const tenantIds = (tenants ?? []).map((t: any) => t.id)
    if (!tenantIds.length) {
      setCountVisitors(0); setCountPayments(0); return
    }

    const [{ count: vc }, { count: pc }] = await Promise.all([
      // Visitors: only 'pending' — approved/rejected need no action
      supabase.from('visitor_requests').select('id', { count: 'exact', head: true })
        .in('tenant_id', tenantIds).eq('status', 'pending'),
      // Payments: only 'pending' — confirmed/rejected need no action
      supabase.from('payments').select('id', { count: 'exact', head: true })
        .in('tenant_id', tenantIds).eq('status', 'pending'),
    ])
    setCountVisitors(vc ?? 0)
    setCountPayments(pc ?? 0)

    // Lost & Found: unread notifications sent to this landlord
    const { count: lfCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('is_read', false)
      .in('notification_type', ['lost_found', 'lost_found_claim', 'lost_found_accepted', 'lost_found_rejected'])
    setCountLostFound(lfCount ?? 0)

  }, [profile?.id])

  // ── Always-current ref — Realtime callbacks use this so the channel never
  //    holds a stale closure, even across re-renders ──────────────────────────
  const fetchCountsRef = useRef(fetchCounts)
  useEffect(() => { fetchCountsRef.current = fetchCounts }, [fetchCounts])

  // ── Refresh on mount + every route navigation ──────────────────────────────
  // Route-change refresh is the most reliable safety net: even if a Realtime
  // event is missed, navigating to any tab immediately recalculates the dots.
  useEffect(() => {
    fetchCounts()
  }, [fetchCounts, location.pathname])

  // ── Realtime subscriptions — stable channel, only recreates on login/logout
  //    Uses fetchCountsRef so it always calls the latest fetcher ───────────────
  useEffect(() => {
    if (!profile?.id) return

    const channel = supabase
      .channel('layout-tab-dots')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' },
          () => fetchCountsRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_requests' },
          () => fetchCountsRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitor_requests' },
          () => fetchCountsRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' },
          () => fetchCountsRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' },
          () => fetchCountsRef.current())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id]) // intentionally excludes fetchCounts — ref handles staleness

  // ── Visibility refresh — catches updates made in another tab/window ─────────
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') fetchCountsRef.current()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  const anyDot = countRegistrations > 0 || countMaintenance > 0 || countVisitors > 0 || countPayments > 0 || countLostFound > 0

  type NavDef = { to: string; icon: React.ElementType; label: string; end?: boolean; count?: number }

  const navItems: NavDef[] = [
    { to: '/landlord',               icon: LayoutDashboard, label: 'Home',          end: true, count: countPayments      },
    { to: '/landlord/renters',       icon: Users,           label: 'Renters'                                             },
    { to: '/landlord/buildings',     icon: Building2,       label: 'Rooms'                                               },
    { to: '/landlord/registrations', icon: UserCheck,       label: 'Registrations',            count: countRegistrations },
    { to: '/landlord/announcements', icon: Megaphone,       label: 'Announcements'                                       },
    { to: '/landlord/lost-found',    icon: Search,          label: 'Lost & Found',             count: countLostFound     },
    { to: '/landlord/electricity',   icon: Zap,             label: 'Electricity'                                         },
    { to: '/landlord/maintenance',   icon: Wrench,          label: 'Maintenance',              count: countMaintenance   },
    { to: '/landlord/visitors',      icon: CalendarCheck,   label: 'Visitors',                 count: countVisitors      },
    { to: '/landlord/reports',       icon: FileText,        label: 'Reports'                                             },
  ]

  function NavItem({ to, icon: Icon, label, end, count }: NavDef) {
    return (
      <NavLink
        to={to}
        end={end}
        onClick={() => setMobileOpen(false)}
        className={({ isActive }) =>
          `relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-[14px] transition-all duration-200 ${
            isActive
              ? 'text-[#6C5CE7] font-semibold'
              : 'text-slate-500 hover:text-slate-700 font-medium'
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
          <span
            className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center leading-none flex-shrink-0"
            style={{ boxShadow: '0 0 0 2px rgba(255,255,255,0.7)' }}
          >
            {count! > 99 ? '99+' : count}
          </span>
        )}
      </NavLink>
    )
  }

  const sidebar = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-6 flex items-center gap-2.5">
        <img src={atimanLogo} alt="ATIMAN" className="h-7 w-auto object-contain flex-shrink-0" />
        <span className="text-[20px] font-bold tracking-tight text-[#1e1b4b]">ATIMAN</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => <NavItem key={item.to} {...item} />)}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.3)' }}>
        <NavLink
          to="/landlord/settings"
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2.5 rounded-xl text-[14px] transition-all duration-200 ${
              isActive ? 'text-[#6C5CE7] font-semibold' : 'text-slate-500 hover:text-slate-700 font-medium'
            }`
          }
          style={({ isActive }) => isActive ? {
            background: 'rgba(108,92,231,0.12)', border: '1px solid rgba(108,92,231,0.18)',
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
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
            style={{ background: 'rgba(108,92,231,0.8)', boxShadow: '0 2px 8px rgba(108,92,231,0.3)' }}>
            {profile?.full_name?.[0]?.toUpperCase() ?? 'L'}
          </div>
          <div className="overflow-hidden">
            <p className="text-[13px] font-semibold text-[#1e1b4b] truncate">{profile?.full_name}</p>
            <p className="text-[11px] text-slate-400">Landlord</p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 left-0 z-30" style={SIDEBAR_GLASS}>
        {sidebar}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 flex flex-col shadow-2xl" style={SIDEBAR_GLASS}>
            <button onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 transition-colors"
              style={{ background: 'rgba(255,255,255,0.25)' }}>
              <X size={20} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Desktop header */}
        <header className="hidden lg:flex px-8 py-4 items-center sticky top-0 z-20" style={MOBILE_HEADER_GLASS}>
          <span className="text-[14px] text-slate-500">{profile?.full_name}</span>
        </header>

        {/* Mobile header */}
        <header className="lg:hidden px-4 py-4 flex items-center sticky top-0 z-20" style={MOBILE_HEADER_GLASS}>
          <button onClick={() => setMobileOpen(true)}
            className="relative p-2 rounded-xl text-slate-500 transition-colors mr-3"
            style={{ background: 'rgba(255,255,255,0.25)' }}>
            <Menu size={20} />
            {anyDot && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"
                style={{ boxShadow: '0 0 0 1.5px rgba(255,255,255,0.8)' }} />
            )}
          </button>
          <div className="flex items-center gap-2">
            <img src={atimanLogo} alt="ATIMAN" className="h-6 w-auto object-contain" />
            <span className="text-[17px] font-bold tracking-tight text-[#1e1b4b]">ATIMAN</span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-6 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
