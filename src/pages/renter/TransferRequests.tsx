// @ts-nocheck
import { useEffect, useState, useCallback } from 'react'
import {
  ArrowRightLeft, Clock, CheckCircle2, XCircle, Users,
  Building2, ChevronRight, AlertTriangle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency } from '@/lib/utils'

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
  pending_landlord: { label: 'Awaiting Landlord',  color: '#6C5CE7', bg: 'rgba(108,92,231,0.1)', icon: Clock        },
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

/* ── Roommate Approval Modal ── */
function RoommateApprovalModal({
  request, onClose, onDone,
}: {
  request: any; onClose: () => void; onDone: () => void
}) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null)

  // Find this renter's tenant_id in the approvals array
  const myApproval = (request.roommate_approvals ?? []).find(
    (a: any) => a.user_id === profile?.id
  )

  async function respond(decision: 'approved' | 'rejected') {
    setLoading(decision === 'approved' ? 'approve' : 'reject')
    try {
      // Update this renter's entry in roommate_approvals
      const updated = (request.roommate_approvals ?? []).map((a: any) =>
        a.user_id === profile?.id ? { ...a, status: decision } : a
      )

      const allApproved = updated.every((a: any) => a.status === 'approved')
      const anyRejected = updated.some((a: any) => a.status === 'rejected')

      let newStatus = request.status
      if (anyRejected) newStatus = 'rejected'
      else if (allApproved) newStatus = 'pending_landlord'

      const { error } = await supabase
        .from('transfer_requests')
        .update({ roommate_approvals: updated, status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', request.id)

      if (error) throw error

      // If rejected → notify requester
      if (anyRejected) {
        await supabase.from('notifications').insert({
          user_id: request.renter_id,
          title: 'Transfer Request Rejected',
          message: `A roommate rejected your transfer request to Room ${request.to_room?.room_number ?? ''}.`,
          notification_type: 'transfer_rejected',
          is_read: false,
        })
      }

      // If all approved → notify landlord
      if (allApproved && !anyRejected) {
        // Get landlord for this room's building
        const { data: bldg } = await supabase
          .from('buildings').select('landlord_id').eq('id', request.to_room?.building_id).single()
        if (bldg?.landlord_id) {
          await supabase.from('notifications').insert({
            user_id: bldg.landlord_id,
            title: 'Transfer Request Ready for Review',
            message: `All roommates approved a transfer request to Room ${request.to_room?.room_number ?? ''}. Please review and make the final decision.`,
            notification_type: 'transfer_landlord_request',
            is_read: false,
          })
        }
        await supabase.from('notifications').insert({
          user_id: request.renter_id,
          title: 'Roommates Approved!',
          message: `All roommates approved your transfer to Room ${request.to_room?.room_number ?? ''}. Waiting for landlord decision.`,
          notification_type: 'transfer_roommate_approved',
          is_read: false,
        })
      }

      setDone(decision)
      setTimeout(() => { onDone(); onClose() }, 1500)
    } catch (err) {
      console.error(err)
      alert('Failed to respond. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  const alreadyResponded = myApproval && myApproval.status !== 'pending'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!loading ? onClose : undefined} />
      <div className="relative w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden" style={GLASS_MODAL}>
        <div className="w-10 h-1 rounded-full mx-auto mt-3 sm:hidden mb-1" style={{ background: 'rgba(0,0,0,0.1)' }} />
        <div className="px-6 pt-5 pb-6">

          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(108,92,231,0.1)' }}>
              <Users size={18} className="text-[#6C5CE7]" />
            </div>
            <div>
              <h3 className="text-[17px] font-semibold text-[#1D1D1F]">Roommate Request</h3>
              <p className="text-[12px] text-slate-400">Someone wants to move into your room</p>
            </div>
          </div>

          <div className="px-4 py-4 rounded-xl mb-4" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] text-slate-400">Target Room</p>
              <p className="text-[14px] font-bold text-[#1D1D1F]">Room {request.to_room?.room_number}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-slate-400">Requested</p>
              <p className="text-[13px] text-slate-500">{timeAgo(request.created_at)}</p>
            </div>
          </div>

          {/* Roommate approvals progress */}
          <div className="mb-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">Approval Status</p>
            <div className="space-y-1.5">
              {(request.roommate_approvals ?? []).map((a: any, i: number) => {
                const isMe = a.user_id === profile?.id
                return (
                  <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl"
                    style={{ background: isMe ? 'rgba(108,92,231,0.06)' : 'rgba(0,0,0,0.02)', border: isMe ? '1px solid rgba(108,92,231,0.15)' : '1px solid transparent' }}>
                    <span className="text-[13px] font-medium text-[#1D1D1F]">
                      {isMe ? 'You' : a.name || 'Roommate'}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={a.status === 'approved'
                        ? { background: 'rgba(52,199,89,0.12)', color: '#15803d' }
                        : a.status === 'rejected'
                        ? { background: 'rgba(255,59,48,0.1)', color: '#dc2626' }
                        : { background: 'rgba(245,158,11,0.1)', color: '#d97706' }}>
                      {a.status === 'approved' ? 'Approved' : a.status === 'rejected' ? 'Rejected' : 'Pending'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {done && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-4"
              style={done === 'approved'
                ? { background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.2)' }
                : { background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)' }}>
              {done === 'approved' ? <CheckCircle2 size={15} className="text-green-600" /> : <XCircle size={15} className="text-red-500" />}
              <p className="text-[13px] font-semibold" style={{ color: done === 'approved' ? '#15803d' : '#dc2626' }}>
                {done === 'approved' ? 'You approved this request.' : 'You rejected this request.'}
              </p>
            </div>
          )}

          {!done && !alreadyResponded && (
            <div className="flex gap-2">
              <button onClick={() => respond('rejected')} disabled={!!loading}
                className="flex-1 h-11 rounded-xl font-semibold text-[14px] transition-all"
                style={{ background: loading === 'reject' ? 'rgba(255,59,48,0.4)' : 'rgba(255,59,48,0.1)', color: '#dc2626' }}>
                {loading === 'reject' ? 'Rejecting…' : 'Reject'}
              </button>
              <button onClick={() => respond('approved')} disabled={!!loading}
                className="flex-1 h-11 rounded-xl font-semibold text-[14px] text-white transition-all"
                style={{ background: loading === 'approve' ? 'rgba(52,199,89,0.5)' : '#34C759' }}>
                {loading === 'approve' ? 'Approving…' : 'Approve'}
              </button>
            </div>
          )}

          {(done || alreadyResponded) && (
            <button onClick={onClose}
              className="w-full h-11 rounded-xl font-medium text-[14px] text-slate-500"
              style={{ background: 'rgba(0,0,0,0.05)' }}>Close</button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Main Page ── */
export default function TransferRequests() {
  const { profile } = useAuth()
  const [myRequests, setMyRequests]         = useState<any[]>([])
  const [needApproval, setNeedApproval]     = useState<any[]>([])
  const [loading, setLoading]               = useState(true)
  const [selected, setSelected]             = useState<any | null>(null)
  const [tab, setTab]                       = useState<'mine' | 'approvals'>('mine')

  const init = useCallback(async (silent = false) => {
    if (!profile?.id) return
    if (!silent) setLoading(true)
    try {
      // 1. My submitted requests
      const { data: mine } = await supabase
        .from('transfer_requests')
        .select(`
          id, status, roommate_approvals, rejection_reason, created_at, updated_at,
          from_room:from_room_id(id, room_number, building:building_id(name)),
          to_room:to_room_id(id, room_number, building_id, building:building_id(name))
        `)
        .eq('renter_id', profile.id)
        .order('created_at', { ascending: false })
      setMyRequests(mine ?? [])

      // 2. Requests I need to approve (my room is the target)
      const { data: myTenant } = await supabase
        .from('tenants')
        .select('room_id')
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .maybeSingle()

      if (myTenant?.room_id) {
        const { data: incoming } = await supabase
          .from('transfer_requests')
          .select(`
            id, status, renter_id, roommate_approvals, created_at,
            to_room:to_room_id(id, room_number, building_id, building:building_id(name))
          `)
          .eq('to_room_id', myTenant.room_id)
          .eq('status', 'pending_roommate')
          .neq('renter_id', profile.id)
          .order('created_at', { ascending: false })

        // Only show ones where my approval is still pending
        const pendingForMe = (incoming ?? []).filter((r: any) =>
          (r.roommate_approvals ?? []).some(
            (a: any) => a.user_id === profile.id && a.status === 'pending'
          )
        )
        setNeedApproval(pendingForMe)
      } else {
        setNeedApproval([])
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    init()
    const ch = supabase.channel('transfer-requests-renter')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transfer_requests' }, () => init(true))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [init])

  function approvalCount() {
    const total = (selected?.roommate_approvals ?? []).length
    const done  = (selected?.roommate_approvals ?? []).filter((a: any) => a.status === 'approved').length
    return { total, done }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-52 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.4)' }} />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.35)' }} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">

      <div>
        <h1 className="text-[26px] sm:text-[28px] font-semibold tracking-tight text-[#1D1D1F]">Transfer Requests</h1>
        <p className="text-[13px] text-[#6E6E73] mt-0.5">Room transfer requests and approvals</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.4)' }}>
        <button onClick={() => setTab('mine')}
          className="flex-1 h-9 rounded-lg text-[13px] font-semibold transition-all"
          style={tab === 'mine' ? { background: '#fff', color: '#1D1D1F', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' } : { color: '#6E6E73' }}>
          My Requests
          {myRequests.length > 0 && (
            <span className="ml-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(108,92,231,0.12)', color: '#6C5CE7' }}>{myRequests.length}</span>
          )}
        </button>
        <button onClick={() => setTab('approvals')}
          className="flex-1 h-9 rounded-lg text-[13px] font-semibold transition-all"
          style={tab === 'approvals' ? { background: '#fff', color: '#1D1D1F', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' } : { color: '#6E6E73' }}>
          Need Your Approval
          {needApproval.length > 0 && (
            <span className="ml-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(255,59,48,0.1)', color: '#dc2626' }}>{needApproval.length}</span>
          )}
        </button>
      </div>

      {/* My Requests */}
      {tab === 'mine' && (
        <div className="space-y-3">
          {myRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                style={{ background: 'rgba(255,255,255,0.35)' }}>
                <ArrowRightLeft size={24} className="text-[#AEAEB2]" />
              </div>
              <p className="text-[16px] font-semibold text-[#1D1D1F]">No transfer requests</p>
              <p className="text-[13px] text-[#6E6E73] mt-1 max-w-xs">
                Browse rooms and click "Request Transfer" to get started.
              </p>
            </div>
          ) : myRequests.map((req: any) => {
            const cfg = STATUS_CFG[req.status] ?? STATUS_CFG.cancelled
            const Icon = cfg.icon
            const approvals = req.roommate_approvals ?? []
            const approved  = approvals.filter((a: any) => a.status === 'approved').length

            return (
              <div key={req.id} className="p-5 rounded-2xl" style={GLASS}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 size={13} className="text-slate-400" />
                      <p className="text-[11px] text-slate-400">
                        {req.from_room ? `Room ${req.from_room.room_number}` : 'Current Room'}
                        {' → '}
                        Room {req.to_room?.room_number}
                      </p>
                    </div>
                    <p className="text-[15px] font-semibold text-[#1D1D1F]">
                      {req.to_room?.building?.name ?? 'Building'}
                    </p>
                    <p className="text-[12px] text-slate-400 mt-0.5">{timeAgo(req.created_at)}</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                    style={{ background: cfg.bg, color: cfg.color }}>
                    <Icon size={11} />
                    {cfg.label}
                  </span>
                </div>

                {/* Approval progress */}
                {approvals.length > 0 && req.status !== 'approved' && req.status !== 'rejected' && req.status !== 'cancelled' && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[11px] font-semibold text-slate-400">Roommate Approvals</p>
                      <p className="text-[11px] font-bold text-[#1D1D1F]">{approved}/{approvals.length}</p>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.07)' }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: approvals.length > 0 ? `${(approved / approvals.length) * 100}%` : '0%',
                          background: '#34C759',
                        }} />
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {approvals.map((a: any, i: number) => (
                        <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={a.status === 'approved'
                            ? { background: 'rgba(52,199,89,0.12)', color: '#15803d' }
                            : a.status === 'rejected'
                            ? { background: 'rgba(255,59,48,0.1)', color: '#dc2626' }
                            : { background: 'rgba(0,0,0,0.06)', color: '#6b7280' }}>
                          {a.name?.split(' ')[0] ?? 'Roommate'} · {a.status}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {req.status === 'rejected' && req.rejection_reason && (
                  <div className="mt-3 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,59,48,0.07)' }}>
                    <p className="text-[12px] text-red-600">Reason: {req.rejection_reason}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Need Your Approval */}
      {tab === 'approvals' && (
        <div className="space-y-3">
          {needApproval.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                style={{ background: 'rgba(255,255,255,0.35)' }}>
                <CheckCircle2 size={24} className="text-[#AEAEB2]" />
              </div>
              <p className="text-[16px] font-semibold text-[#1D1D1F]">No pending approvals</p>
              <p className="text-[13px] text-[#6E6E73] mt-1">You're all caught up.</p>
            </div>
          ) : needApproval.map((req: any) => {
            const myEntry = (req.roommate_approvals ?? []).find((a: any) => a.user_id === profile?.id)
            const { total, done } = (() => {
              const all = req.roommate_approvals ?? []
              return { total: all.length, done: all.filter((a: any) => a.status === 'approved').length }
            })()

            return (
              <button key={req.id} onClick={() => setSelected(req)}
                className="w-full text-left p-5 rounded-2xl transition-all"
                style={GLASS}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle size={13} className="text-amber-500" />
                      <p className="text-[11px] font-semibold text-amber-600">Needs Your Approval</p>
                    </div>
                    <p className="text-[15px] font-semibold text-[#1D1D1F]">Room {req.to_room?.room_number}</p>
                    <p className="text-[12px] text-slate-400 mt-0.5">
                      {req.to_room?.building?.name} · {timeAgo(req.created_at)}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <div className="h-1.5 w-24 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.07)' }}>
                        <div className="h-full rounded-full" style={{ width: `${(done / total) * 100}%`, background: '#34C759' }} />
                      </div>
                      <p className="text-[11px] text-slate-400">{done}/{total} approved</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 flex-shrink-0" />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selected && (
        <RoommateApprovalModal
          request={selected}
          onClose={() => setSelected(null)}
          onDone={() => { init(true); setSelected(null) }}
        />
      )}
    </div>
  )
}
