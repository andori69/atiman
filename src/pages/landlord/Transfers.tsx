// @ts-nocheck
import { useEffect, useState, useCallback } from 'react'
import {
  ArrowRightLeft, Clock, CheckCircle2, XCircle, Users,
  Building2, ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const GLASS = {
  background: 'rgba(255,255,255,0.28)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.45)',
  borderRadius: 16,
}

const GLASS_MODAL = {
  background: 'rgba(255,255,255,0.97)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.65)',
  borderRadius: 20,
  boxShadow: '0 24px 64px rgba(100,80,200,0.18)',
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending_roommate: { label: 'Awaiting Roommates', color: '#d97706', bg: 'rgba(245,158,11,0.1)',   icon: Clock        },
  pending_landlord: { label: 'Awaiting Your Decision', color: '#6C5CE7', bg: 'rgba(108,92,231,0.1)', icon: AlertTriangle },
  approved:         { label: 'Approved',            color: '#15803d', bg: 'rgba(52,199,89,0.1)',  icon: CheckCircle2 },
  rejected:         { label: 'Rejected',            color: '#dc2626', bg: 'rgba(255,59,48,0.1)', icon: XCircle      },
  cancelled:        { label: 'Cancelled',           color: '#6b7280', bg: 'rgba(0,0,0,0.06)',    icon: XCircle      },
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/* ── Decision Modal ── */
function DecisionModal({
  request, onClose, onDone,
}: {
  request: any; onClose: () => void; onDone: () => void
}) {
  const { profile } = useAuth()
  const [loading, setLoading]     = useState<'approve' | 'reject' | null>(null)
  const [reason, setReason]       = useState('')
  const [showReject, setShowReject] = useState(false)
  const [done, setDone]           = useState<'approved' | 'rejected' | null>(null)

  const approvals = request.roommate_approvals ?? []
  const allApproved = approvals.length === 0 || approvals.every((a: any) => a.status === 'approved')

  async function approve() {
    setLoading('approve')
    try {
      // 1. Update transfer request
      const { error: trErr } = await supabase
        .from('transfer_requests')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', request.id)
      if (trErr) throw trErr

      // 2. Move tenant to new room
      const { error: tenErr } = await supabase
        .from('tenants')
        .update({ room_id: request.to_room_id, updated_at: new Date().toISOString() })
        .eq('id', request.tenant_id)
      if (tenErr) throw tenErr

      // 3. Update old room status if now empty
      if (request.from_room_id) {
        const { data: leftTenants } = await supabase
          .from('tenants')
          .select('id', { count: 'exact', head: true })
          .eq('room_id', request.from_room_id)
          .eq('is_active', true)
          .neq('id', request.tenant_id)
        const count = leftTenants?.length ?? 0
        // The .neq above doesn't work with head:true — use count
        const { count: remaining } = await supabase
          .from('tenants')
          .select('id', { count: 'exact', head: true })
          .eq('room_id', request.from_room_id)
          .eq('is_active', true)
        // After update, tenant's room_id changed so count will be accurate
        if ((remaining ?? 1) <= 1) {
          await supabase.from('rooms').update({ status: 'vacant' }).eq('id', request.from_room_id)
        }
      }

      // 4. Update new room status to occupied
      await supabase.from('rooms').update({ status: 'occupied' }).eq('id', request.to_room_id)

      // 5. Notify renter
      await supabase.from('notifications').insert({
        user_id: request.renter_id,
        title: 'Transfer Approved!',
        message: `Your transfer to Room ${request.to_room?.room_number ?? ''} has been approved by your landlord. Welcome to your new room!`,
        notification_type: 'transfer_approved',
        is_read: false,
      })

      setDone('approved')
      setTimeout(() => { onDone(); onClose() }, 1800)
    } catch (err) {
      console.error(err)
      alert('Failed to approve. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  async function reject() {
    setLoading('reject')
    try {
      await supabase
        .from('transfer_requests')
        .update({ status: 'rejected', rejection_reason: reason || null, updated_at: new Date().toISOString() })
        .eq('id', request.id)

      await supabase.from('notifications').insert({
        user_id: request.renter_id,
        title: 'Transfer Request Rejected',
        message: `Your transfer request to Room ${request.to_room?.room_number ?? ''} was not approved by your landlord${reason ? `: "${reason}"` : '.'}`,
        notification_type: 'transfer_rejected',
        is_read: false,
      })

      setDone('rejected')
      setTimeout(() => { onDone(); onClose() }, 1800)
    } catch (err) {
      console.error(err)
      alert('Failed to reject. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!loading ? onClose : undefined} />
      <div className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden" style={GLASS_MODAL}>
        <div className="w-10 h-1 rounded-full mx-auto mt-3 sm:hidden mb-1" style={{ background: 'rgba(0,0,0,0.1)' }} />
        <div className="px-6 pt-5 pb-6">

          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(108,92,231,0.1)' }}>
              <ArrowRightLeft size={18} className="text-[#6C5CE7]" />
            </div>
            <div>
              <h3 className="text-[17px] font-semibold text-[#1D1D1F]">Transfer Request</h3>
              <p className="text-[12px] text-slate-400">Final landlord decision</p>
            </div>
          </div>

          {/* Details */}
          <div className="px-4 py-4 rounded-xl mb-4 space-y-2"
            style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-slate-400">From</p>
              <p className="text-[13px] font-semibold text-[#1D1D1F]">
                {request.from_room ? `Room ${request.from_room.room_number}` : 'N/A'}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-slate-400">To</p>
              <p className="text-[13px] font-semibold text-[#1D1D1F]">Room {request.to_room?.room_number}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-slate-400">Building</p>
              <p className="text-[13px] font-semibold text-[#1D1D1F]">{request.to_room?.building?.name}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-slate-400">Requested</p>
              <p className="text-[13px] text-slate-500">{timeAgo(request.created_at)}</p>
            </div>
          </div>

          {/* Roommate approvals */}
          {approvals.length > 0 && (
            <div className="mb-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Roommate Approvals</p>
              <div className="space-y-1.5">
                {approvals.map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl"
                    style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)' }}>
                    <span className="text-[13px] font-medium text-[#1D1D1F]">{a.name || 'Roommate'}</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={a.status === 'approved'
                        ? { background: 'rgba(52,199,89,0.12)', color: '#15803d' }
                        : a.status === 'rejected'
                        ? { background: 'rgba(255,59,48,0.1)', color: '#dc2626' }
                        : { background: 'rgba(245,158,11,0.1)', color: '#d97706' }}>
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {done && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-4"
              style={done === 'approved'
                ? { background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.2)' }
                : { background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)' }}>
              {done === 'approved'
                ? <CheckCircle2 size={15} className="text-green-600" />
                : <XCircle size={15} className="text-red-500" />}
              <p className="text-[13px] font-semibold" style={{ color: done === 'approved' ? '#15803d' : '#dc2626' }}>
                {done === 'approved' ? 'Transfer approved. Room updated.' : 'Transfer rejected.'}
              </p>
            </div>
          )}

          {!done && request.status === 'pending_landlord' && (
            <>
              {showReject && (
                <div className="mb-3">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Reason (optional)</p>
                  <textarea
                    value={reason} onChange={e => setReason(e.target.value)}
                    placeholder="Tell the renter why their request was rejected…"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl text-[13px] text-[#1D1D1F] resize-none outline-none"
                    style={{ background: '#F5F5F7', border: '1px solid rgba(0,0,0,0.08)' }}
                  />
                </div>
              )}

              {!allApproved && (
                <div className="px-4 py-3 rounded-xl mb-4" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <p className="text-[12px] text-amber-700">Not all roommates have approved yet. You can still make a decision.</p>
                </div>
              )}

              <div className="flex gap-2">
                {!showReject ? (
                  <>
                    <button onClick={() => setShowReject(true)} disabled={!!loading}
                      className="flex-1 h-11 rounded-xl font-semibold text-[14px] transition-all"
                      style={{ background: 'rgba(255,59,48,0.1)', color: '#dc2626' }}>
                      Reject
                    </button>
                    <button onClick={approve} disabled={!!loading}
                      className="flex-1 h-11 rounded-xl font-semibold text-[14px] text-white transition-all"
                      style={{ background: loading === 'approve' ? 'rgba(52,199,89,0.5)' : '#34C759' }}>
                      {loading === 'approve' ? 'Approving…' : 'Approve Transfer'}
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setShowReject(false)} disabled={!!loading}
                      className="flex-1 h-11 rounded-xl font-medium text-[14px] text-slate-500"
                      style={{ background: 'rgba(0,0,0,0.05)' }}>Back</button>
                    <button onClick={reject} disabled={!!loading}
                      className="flex-1 h-11 rounded-xl font-semibold text-[14px] text-white transition-all"
                      style={{ background: loading === 'reject' ? 'rgba(255,59,48,0.4)' : '#FF3B30' }}>
                      {loading === 'reject' ? 'Rejecting…' : 'Confirm Reject'}
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {(!done && request.status !== 'pending_landlord') && (
            <button onClick={onClose}
              className="w-full h-11 rounded-xl font-medium text-[14px] text-slate-500"
              style={{ background: 'rgba(0,0,0,0.05)' }}>Close</button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Request Card ── */
function RequestCard({ request, onClick }: { request: any; onClick: () => void }) {
  const cfg = STATUS_CFG[request.status] ?? STATUS_CFG.cancelled
  const Icon = cfg.icon
  const approvals = request.roommate_approvals ?? []
  const approved  = approvals.filter((a: any) => a.status === 'approved').length

  return (
    <button onClick={onClick} className="w-full text-left p-5 rounded-2xl transition-all active:scale-[0.98]"
      style={GLASS}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(108,92,231,0.1)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '' }}>

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <Building2 size={12} className="text-slate-400" />
            <p className="text-[11px] text-slate-400">
              {request.from_room ? `Room ${request.from_room.room_number}` : '?'}
              {' → '}
              Room {request.to_room?.room_number}
              {' · '}
              {request.to_room?.building?.name}
            </p>
          </div>
          <p className="text-[15px] font-semibold text-[#1D1D1F]">{request.renter_name ?? 'Renter'}</p>
          <p className="text-[12px] text-slate-400 mt-0.5">{timeAgo(request.created_at)}</p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
          style={{ background: cfg.bg, color: cfg.color }}>
          <Icon size={11} />{cfg.label}
        </span>
      </div>

      {approvals.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] text-slate-400">Roommate Approvals</p>
            <p className="text-[11px] font-bold text-[#1D1D1F]">{approved}/{approvals.length}</p>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.07)' }}>
            <div className="h-full rounded-full transition-all"
              style={{
                width: approvals.length > 0 ? `${(approved / approvals.length) * 100}%` : '0%',
                background: '#34C759',
              }} />
          </div>
        </div>
      )}
    </button>
  )
}

/* ── Main Page ── */
export default function LandlordTransfers() {
  const { profile } = useAuth()
  const [requests, setRequests]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<any | null>(null)
  const [filter, setFilter]       = useState<'all' | 'action' | 'done'>('all')

  const init = useCallback(async (silent = false) => {
    if (!profile?.id) return
    if (!silent) setLoading(true)
    try {
      // Get landlord's room IDs
      const { data: bldgs } = await supabase
        .from('buildings').select('id').eq('landlord_id', profile.id)
      const bldgIds = (bldgs ?? []).map((b: any) => b.id)
      if (!bldgIds.length) { setRequests([]); return }

      const { data: rooms } = await supabase
        .from('rooms').select('id').in('building_id', bldgIds)
      const roomIds = (rooms ?? []).map((r: any) => r.id)
      if (!roomIds.length) { setRequests([]); return }

      const { data: trs } = await supabase
        .from('transfer_requests')
        .select(`
          id, renter_id, tenant_id, status, roommate_approvals, rejection_reason, created_at, updated_at,
          from_room:from_room_id(id, room_number, building:building_id(name)),
          to_room:to_room_id(id, room_number, building_id, building:building_id(name))
        `)
        .in('to_room_id', roomIds)
        .order('created_at', { ascending: false })

      // Fetch renter names
      const renterIds = [...new Set((trs ?? []).map((t: any) => t.renter_id))]
      let renterMap: Record<string, string> = {}
      if (renterIds.length) {
        const { data: profiles } = await supabase
          .from('profiles').select('id, full_name').in('id', renterIds)
        for (const p of profiles ?? []) renterMap[p.id] = p.full_name
      }

      setRequests((trs ?? []).map((tr: any) => ({
        ...tr,
        renter_name: renterMap[tr.renter_id] ?? 'Renter',
      })))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    init()
    const ch = supabase.channel('landlord-transfers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transfer_requests' }, () => init(true))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [init])

  const filtered = requests.filter(r => {
    if (filter === 'action') return r.status === 'pending_landlord'
    if (filter === 'done') return ['approved', 'rejected', 'cancelled'].includes(r.status)
    return true
  })

  const actionCount = requests.filter(r => r.status === 'pending_landlord').length

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.4)' }} />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.35)' }} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] sm:text-[28px] font-semibold tracking-tight text-[#1D1D1F]">Room Transfers</h1>
          <p className="text-[13px] text-[#6E6E73] mt-0.5">
            {actionCount > 0 ? `${actionCount} waiting for your decision` : 'All caught up'}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.4)' }}>
        {([
          { key: 'all',    label: 'All' },
          { key: 'action', label: 'Needs Action' },
          { key: 'done',   label: 'Completed' },
        ] as const).map(opt => (
          <button key={opt.key} onClick={() => setFilter(opt.key)}
            className="flex-1 h-9 rounded-lg text-[13px] font-semibold transition-all"
            style={filter === opt.key
              ? { background: '#fff', color: '#1D1D1F', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
              : { color: '#6E6E73' }}>
            {opt.label}
            {opt.key === 'action' && actionCount > 0 && (
              <span className="ml-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(255,59,48,0.1)', color: '#dc2626' }}>{actionCount}</span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: 'rgba(255,255,255,0.35)' }}>
            <ArrowRightLeft size={24} className="text-[#AEAEB2]" />
          </div>
          <p className="text-[16px] font-semibold text-[#1D1D1F]">
            {filter === 'action' ? 'Nothing needs your attention' : 'No transfer requests'}
          </p>
          <p className="text-[13px] text-[#6E6E73] mt-1">Requests from renters will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => (
            <RequestCard key={req.id} request={req} onClick={() => setSelected(req)} />
          ))}
        </div>
      )}

      {selected && (
        <DecisionModal
          request={selected}
          onClose={() => setSelected(null)}
          onDone={() => { init(true); setSelected(null) }}
        />
      )}
    </div>
  )
}
