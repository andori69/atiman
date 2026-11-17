// @ts-nocheck
import { useEffect, useState, useMemo } from 'react'
import {
  Users, Calendar, Clock, CheckCircle2, AlertTriangle, X,
  ThumbsUp, ThumbsDown, Search, LayoutGrid,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { timeAgo } from '@/lib/utils'

const GLASS = {
  background: 'rgba(255,255,255,0.22)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.45)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(108,92,231,0.06), 0 1px 1px rgba(255,255,255,0.5) inset',
}

const GLASS_CARD = {
  background: 'rgba(255,255,255,0.28)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(255,255,255,0.5)',
  borderRadius: 14,
  boxShadow: '0 2px 8px rgba(108,92,231,0.05)',
  cursor: 'pointer',
  willChange: 'transform',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
}

const GLASS_MODAL = {
  background: 'rgba(255,255,255,0.95)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.65)',
  borderRadius: 20,
  boxShadow: '0 24px 64px rgba(100,80,200,0.18)',
}

const VISITOR_SECTIONS = [
  { key: 'pending',  label: 'Pending',  icon: Clock,         color: '#d97706', bg: 'rgba(245,158,11,0.1)'  },
  { key: 'approved', label: 'Approved', icon: CheckCircle2,  color: '#059669', bg: 'rgba(16,185,129,0.1)' },
  { key: 'rejected', label: 'Rejected', icon: AlertTriangle, color: '#ef4444', bg: 'rgba(255,59,48,0.09)' },
]

const STATUS: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  pending:  { label: 'Pending',  color: '#d97706', bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.25)',  icon: Clock        },
  approved: { label: 'Approved', color: '#059669', bg: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.25)', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: '#ef4444', bg: 'rgba(255,59,48,0.09)',   border: 'rgba(255,59,48,0.22)',  icon: AlertTriangle },
}

function fmt12(t: string) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${((h % 12) || 12)}:${String(m).padStart(2, '0')} ${ampm}`
}
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtTimeRange(start: string, end?: string | null, overnight?: boolean) {
  if (!start) return ''
  if (overnight) return `${fmt12(start)} → Overnight 🌙`
  if (!end) return fmt12(start)
  return `${fmt12(start)} → ${fmt12(end)}`
}
function initials(name: string) { return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() }
function avatarColor(name: string) {
  const c = ['#8b5cf6','#3b82f6','#10b981','#f59e0b','#ef4444','#06b6d4','#6366f1','#14b8a6']
  let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % c.length; return c[h]
}

function Avatar({ url, name, size = 30 }: { url?: string | null; name: string; size?: number }) {
  const dim = `${size}px`
  if (url) return (
    <img src={url} alt={name} loading="lazy" decoding="async"
      style={{ width: dim, height: dim, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  )
  return (
    <div style={{
      width: dim, height: dim, borderRadius: '50%', flexShrink: 0,
      background: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: 700, fontSize: size * 0.33,
    }}>
      {initials(name)}
    </div>
  )
}

/* ── Detail Modal ── */
function DetailModal({ visitor, onClose, onApprove, onConfirmReject, actionLoading, rejectLoading }: {
  visitor: any; onClose: () => void
  onApprove: (v: any) => void
  onConfirmReject: (v: any, reason: string) => void
  actionLoading: string; rejectLoading: boolean
}) {
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const sc = STATUS[visitor.status] ?? STATUS.pending
  const StatusIcon = sc.icon
  const avatarUrl = visitor.avatar_url ?? visitor.tenant?.photo_url ?? null

  if (showReject) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowReject(false)} />
        <div className="relative w-full max-w-sm p-6" style={GLASS_MODAL}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[18px] font-bold text-[#1e1b4b]">Reject Visitor</h2>
            <button onClick={() => setShowReject(false)} className="p-2 rounded-xl text-slate-400"
              style={{ background: 'rgba(0,0,0,0.06)' }}><X size={18} /></button>
          </div>
          <div className="mb-4 p-4 rounded-2xl" style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)' }}>
            <p className="text-[13px] font-semibold text-[#1e1b4b]">
              {visitor.visitor_count ?? 1} {(visitor.visitor_count ?? 1) === 1 ? 'visitor' : 'visitors'}
              {visitor.relationship ? ` · ${visitor.relationship}` : ''}
            </p>
            <p className="text-[12px] text-slate-400 mt-0.5">
              {fmtDate(visitor.visit_date)} · {fmtTimeRange(visitor.visit_time, visitor.visit_end_time, visitor.is_overnight)}
            </p>
            <p className="text-[12px] text-slate-400 mt-0.5">
              {visitor.tenant?.name} · {visitor.tenant?.room?.room_number ? `Room ${visitor.tenant.room.room_number}` : ''}
            </p>
          </div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Reason (optional)</label>
          <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
            placeholder="e.g. Visitor not on approved list, restricted visit hours…" rows={3}
            className="w-full rounded-xl px-4 py-3 text-[14px] text-[#1e1b4b] outline-none focus:ring-2 focus:ring-red-400 resize-none mb-4"
            style={{ background: '#F5F5F7' }} />
          <div className="flex gap-3">
            <button onClick={() => setShowReject(false)}
              className="flex-1 h-11 rounded-xl font-medium text-[15px] text-slate-500"
              style={{ background: 'rgba(0,0,0,0.06)' }}>Cancel</button>
            <button onClick={() => { onConfirmReject(visitor, rejectReason); onClose() }} disabled={rejectLoading}
              className="flex-1 h-11 rounded-xl font-semibold text-[15px] text-white disabled:opacity-50"
              style={{ background: '#ef4444', boxShadow: '0 4px 12px rgba(255,59,48,0.3)' }}>
              {rejectLoading ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden" style={GLASS_MODAL}>
        <div className="flex items-center justify-between px-6 py-5 flex-shrink-0"
          style={{ background: sc.bg, borderBottom: '1px solid rgba(0,0,0,0.06)', borderRadius: '20px 20px 0 0' }}>
          <div className="flex items-center gap-3 min-w-0">
            <Avatar url={avatarUrl} name={visitor.tenant?.name ?? '?'} size={44} />
            <div className="min-w-0">
              <h2 className="text-[16px] font-bold text-[#1e1b4b] truncate">{visitor.tenant?.name}</h2>
              <p className="text-[13px] text-slate-500 mt-0.5">
                {visitor.tenant?.room?.room_number ? `Room ${visitor.tenant.room.room_number}` : ''}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <StatusIcon size={11} style={{ color: sc.color }} />
                <span className="text-[11px] font-bold" style={{ color: sc.color }}>{sc.label}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 flex-shrink-0 ml-2"
            style={{ background: 'rgba(0,0,0,0.05)' }}><X size={18} /></button>
        </div>

        <div className="flex-1 p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3.5" style={{ background: 'rgba(108,92,231,0.06)', border: '1px solid rgba(108,92,231,0.1)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-1">Visitors</p>
              <p className="text-[22px] font-bold text-[#1e1b4b] tabular-nums leading-tight">{visitor.visitor_count ?? 1}</p>
              <p className="text-[11px] text-slate-400">{(visitor.visitor_count ?? 1) === 1 ? 'person' : 'people'}</p>
            </div>
            <div className="rounded-xl p-3.5" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Relationship</p>
              <p className="text-[14px] font-semibold text-[#1e1b4b]">{visitor.relationship || '—'}</p>
            </div>
            <div className="rounded-xl p-3.5" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Date</p>
              <p className="text-[13px] font-semibold text-[#1e1b4b]">{fmtDate(visitor.visit_date)}</p>
            </div>
            <div className="rounded-xl p-3.5" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Time</p>
              <p className="text-[13px] font-semibold text-[#1e1b4b]">{fmtTimeRange(visitor.visit_time, visitor.visit_end_time, visitor.is_overnight)}</p>
            </div>
            <div className="col-span-2 rounded-xl p-3.5" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Purpose</p>
              <p className="text-[13px] font-semibold text-[#1e1b4b]">{visitor.purpose}</p>
            </div>
          </div>

          {visitor.status === 'rejected' && visitor.rejection_reason && (
            <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.15)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-1">Rejection Reason</p>
              <p className="text-[13px] text-red-700">{visitor.rejection_reason}</p>
            </div>
          )}
          <p className="text-[11px] text-slate-400">Submitted {timeAgo(visitor.created_at)}</p>

          {visitor.status === 'pending' && (
            <div className="flex gap-3 pt-1">
              <button onClick={() => { onApprove(visitor); onClose() }} disabled={actionLoading === visitor.id}
                className="flex-1 flex items-center justify-center gap-2 h-11 text-white rounded-xl text-[14px] font-semibold disabled:opacity-50"
                style={{ background: 'rgba(16,185,129,0.88)', boxShadow: '0 4px 14px rgba(16,185,129,0.25)' }}>
                <ThumbsUp size={15} /> {actionLoading === visitor.id ? 'Approving…' : 'Approve'}
              </button>
              <button onClick={() => setShowReject(true)}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-[14px] font-semibold"
                style={{ background: 'rgba(255,59,48,0.08)', color: '#ef4444', border: '1px solid rgba(255,59,48,0.18)' }}>
                <ThumbsDown size={15} /> Reject
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Compact Row Card ── */
function VisitorCard({ v, onClick }: { v: any; onClick: () => void }) {
  const sc = STATUS[v.status] ?? STATUS.pending
  const StatusIcon = sc.icon
  const avatarUrl = v.avatar_url ?? v.tenant?.photo_url ?? null
  const count = v.visitor_count ?? 1

  return (
    <div
      onClick={onClick}
      style={GLASS_CARD}
      className="px-3.5 py-2.5 flex items-center gap-3"
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateX(2px)'
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(108,92,231,0.12)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(108,92,231,0.05)'
      }}
    >
      {/* Visitor icon */}
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.15)' }}>
        <Users size={15} className="text-[#6C5CE7]" />
      </div>

      {/* Avatar */}
      <Avatar url={avatarUrl} name={v.tenant?.name ?? '?'} size={30} />

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-[13px] font-bold text-[#1e1b4b] truncate leading-tight">{v.tenant?.name}</p>
          <span className="text-[11px] text-slate-400 flex-shrink-0">
            · {v.tenant?.room?.room_number ? `Rm ${v.tenant.room.room_number}` : '—'}
          </span>
        </div>
        <p className="text-[12px] text-slate-500 truncate leading-snug mt-0.5">
          {count} {count === 1 ? 'visitor' : 'visitors'}
          {v.relationship ? ` · ${v.relationship}` : ''}
          {' · '}{fmtDate(v.visit_date)}
          {v.visit_time ? ` · ${fmtTimeRange(v.visit_time, v.visit_end_time, v.is_overnight)}` : ''}
        </p>
      </div>

      {/* Right: status + time */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
          style={{ background: sc.bg, border: `1px solid ${sc.border}` }}>
          <StatusIcon size={9} style={{ color: sc.color }} />
          <span className="text-[10px] font-bold ml-0.5" style={{ color: sc.color }}>{sc.label}</span>
        </div>
        <span className="text-[10px] text-slate-400 whitespace-nowrap">{timeAgo(v.created_at)}</span>
      </div>
    </div>
  )
}

/* ── Main Page ── */
export default function LandlordVisitors() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [visitors, setVisitors] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('pending')
  const [actionLoading, setActionLoading] = useState('')
  const [rejectLoading, setRejectLoading] = useState(false)
  const [detailTarget, setDetailTarget] = useState<any>(null)

  useEffect(() => { init() }, [])

  useEffect(() => {
    const channel = supabase.channel('visitors-page-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitor_requests' }, () => init(true))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function init(silent = false) {
    if (!silent) setLoading(true)
    try {
      const { data: buildings } = await supabase.from('buildings').select('id').eq('landlord_id', profile!.id)
      if (!buildings?.length) { setVisitors([]); return }
      const buildingIds = buildings.map((b: any) => b.id)

      const { data } = await supabase
        .from('visitor_requests')
        .select('id, visitor_count, relationship, visit_date, visit_time, visit_end_time, purpose, status, rejection_reason, created_at, tenant:tenants(id, name, user_id, photo_url, room:rooms(room_number, building_id))')
        .order('visit_date', { ascending: false })

      setVisitors((data ?? []).filter((v: any) => buildingIds.includes(v.tenant?.room?.building_id)))
    } finally {
      if (!silent) setLoading(false)
    }
  }

  async function approveVisitor(visitor: any) {
    setActionLoading(visitor.id)
    await supabase.from('visitor_requests').update({ status: 'approved' }).eq('id', visitor.id)
    if (visitor.tenant?.user_id) {
      const count = visitor.visitor_count ?? 1
      await supabase.from('notifications').insert({
        user_id: visitor.tenant.user_id,
        title: 'Visitor Approved',
        message: `Your visitor notice for ${count} ${count === 1 ? 'person' : 'people'} on ${fmtDate(visitor.visit_date)} at ${fmtTimeRange(visitor.visit_time, visitor.visit_end_time, visitor.is_overnight)} has been approved. Please remind your visitor(s) to check in at the gate upon arrival and observe silence hours at all times.`,
        notification_type: 'visitor_approved', is_read: false,
      })
    }
    setActionLoading(''); init(true)
  }

  async function rejectVisitor(visitor: any, reason: string) {
    setRejectLoading(true)
    await supabase.from('visitor_requests').update({ status: 'rejected', rejection_reason: reason || null }).eq('id', visitor.id)
    if (visitor.tenant?.user_id) {
      await supabase.from('notifications').insert({
        user_id: visitor.tenant.user_id,
        title: 'Visitor Rejected',
        message: `Your visitor notice for ${fmtDate(visitor.visit_date)} at ${fmtTimeRange(visitor.visit_time, visitor.visit_end_time, visitor.is_overnight)} was not approved.${reason ? ` Reason: ${reason}` : ''}`,
        notification_type: 'visitor_rejected', is_read: false,
      })
    }
    setRejectLoading(false); init(true)
  }

  const counts = useMemo(() => ({
    all:      visitors.length,
    pending:  visitors.filter(v => v.status === 'pending').length,
    approved: visitors.filter(v => v.status === 'approved').length,
    rejected: visitors.filter(v => v.status === 'rejected').length,
  }), [visitors])

  const FILTER_CARDS = [
    { key: 'pending',  label: 'Pending',  icon: Clock,         value: counts.pending,
      activeStyle: { background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' },
      iconActive: { background: '#f59e0b', color: 'white' }, iconInactive: { background: 'rgba(245,158,11,0.1)', color: '#d97706' } },
    { key: 'approved', label: 'Approved', icon: CheckCircle2,  value: counts.approved,
      activeStyle: { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.22)' },
      iconActive: { background: '#10b981', color: 'white' }, iconInactive: { background: 'rgba(16,185,129,0.1)', color: '#059669' } },
    { key: 'rejected', label: 'Rejected', icon: AlertTriangle, value: counts.rejected,
      activeStyle: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' },
      iconActive: { background: '#ef4444', color: 'white' }, iconInactive: { background: 'rgba(239,68,68,0.08)', color: '#ef4444' } },
    { key: 'all',      label: 'All',      icon: LayoutGrid,    value: counts.all,
      activeStyle: { background: 'rgba(108,92,231,0.15)', border: '1px solid rgba(108,92,231,0.3)' },
      iconActive: { background: '#6C5CE7', color: 'white' }, iconInactive: { background: 'rgba(108,92,231,0.1)', color: '#6C5CE7' } },
  ]

  const searchFiltered = useMemo(() => {
    const q = search.toLowerCase()
    return q
      ? visitors.filter(v =>
          v.tenant?.name?.toLowerCase().includes(q) ||
          v.purpose?.toLowerCase().includes(q) ||
          v.relationship?.toLowerCase().includes(q) ||
          v.tenant?.room?.room_number?.toLowerCase().includes(q)
        )
      : visitors
  }, [visitors, search])

  const sectionsToShow = useMemo(() =>
    activeFilter === 'all' ? VISITOR_SECTIONS : VISITOR_SECTIONS.filter(s => s.key === activeFilter),
  [activeFilter])

  function sortSection(items: any[]) {
    return [...items].sort((a, b) => {
      if (activeFilter === 'pending' || (activeFilter === 'all' && a.status === 'pending' && b.status === 'pending')) {
        return new Date(a.visit_date).getTime() - new Date(b.visit_date).getTime()
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }

  const totalVisible = useMemo(() =>
    searchFiltered.filter(v => activeFilter === 'all' || v.status === activeFilter).length,
  [searchFiltered, activeFilter])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight text-[#1e1b4b]">Visitor Requests</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">
          {counts.pending > 0 ? `${counts.pending} pending · ${visitors.length} total` : `${visitors.length} total requests`}
        </p>
      </div>

      {/* Filter / stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {FILTER_CARDS.map(({ key, label, icon: Icon, value, activeStyle, iconActive, iconInactive }) => (
          <button key={key} onClick={() => setActiveFilter(key)}
            className="flex items-center gap-2.5 p-3 sm:p-3.5 rounded-2xl text-left transition-all duration-200"
            style={activeFilter === key ? { ...GLASS, ...activeStyle } : GLASS}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all"
              style={activeFilter === key ? iconActive : iconInactive}>
              <Icon size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[20px] sm:text-[22px] font-bold text-[#1e1b4b] leading-none tabular-nums">{value}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by renter, room, purpose, or relationship…"
          className="w-full h-10 pl-9 pr-4 rounded-xl text-[13px] text-[#1e1b4b] outline-none focus:ring-2 focus:ring-[#6C5CE7]/40"
          style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.6)' }}
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400"
            style={{ background: 'rgba(0,0,0,0.06)' }}><X size={13} /></button>
        )}
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="px-3.5 py-2.5 rounded-[14px] flex items-center gap-3 animate-pulse"
              style={{ background: 'rgba(255,255,255,0.28)', border: '1px solid rgba(255,255,255,0.5)' }}>
              <div className="w-8 h-8 rounded-xl flex-shrink-0" style={{ background: 'rgba(0,0,0,0.06)' }} />
              <div className="w-7 h-7 rounded-full flex-shrink-0" style={{ background: 'rgba(0,0,0,0.06)' }} />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-32 rounded-lg" style={{ background: 'rgba(0,0,0,0.06)' }} />
                <div className="h-2.5 w-48 rounded-lg" style={{ background: 'rgba(0,0,0,0.04)' }} />
              </div>
              <div className="space-y-1.5 flex-shrink-0 items-end flex flex-col">
                <div className="h-4 w-16 rounded-full" style={{ background: 'rgba(0,0,0,0.05)' }} />
                <div className="h-3 w-12 rounded-lg" style={{ background: 'rgba(0,0,0,0.04)' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty — no visitors at all */}
      {!loading && visitors.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.5)' }}>
            <Users size={24} className="text-slate-400" />
          </div>
          <h3 className="text-[17px] font-semibold text-[#1e1b4b] mb-1">No visitor requests</h3>
          <p className="text-[14px] text-slate-400 max-w-xs">Visitor notices from renters will appear here.</p>
        </div>
      )}

      {/* Search returned nothing */}
      {!loading && visitors.length > 0 && search && totalVisible === 0 && (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <Search size={22} className="text-slate-300 mb-2.5" />
          <p className="text-[15px] font-semibold text-[#1e1b4b]">No requests found</p>
          <p className="text-[13px] text-slate-400 mt-1">Try a different search term.</p>
        </div>
      )}

      {/* Sectioned list */}
      {!loading && visitors.length > 0 && !(search && totalVisible === 0) && (
        <div className="space-y-4">
          {sectionsToShow.map(section => {
            const SectionIcon = section.icon
            const cards = sortSection(searchFiltered.filter(v => v.status === section.key))
            if (activeFilter === 'all' && cards.length === 0) return null
            return (
              <div key={section.key}>
                {/* Section header */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: section.bg }}>
                    <SectionIcon size={12} style={{ color: section.color }} />
                  </div>
                  <h2 className="text-[14px] font-bold text-[#1e1b4b]">{section.label}</h2>
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: section.bg, color: section.color }}>
                    {cards.length}
                  </span>
                </div>

                {cards.length === 0 ? (
                  <div className="flex items-center justify-center py-6 rounded-xl"
                    style={{ border: '1.5px dashed rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.12)' }}>
                    <p className="text-[12px] text-slate-400">No {section.label.toLowerCase()} requests</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {cards.map((v: any) => (
                      <VisitorCard key={v.id} v={v} onClick={() => setDetailTarget(v)} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {detailTarget && (
        <DetailModal
          visitor={detailTarget}
          onClose={() => setDetailTarget(null)}
          onApprove={approveVisitor}
          onConfirmReject={rejectVisitor}
          actionLoading={actionLoading}
          rejectLoading={rejectLoading}
        />
      )}
    </div>
  )
}
