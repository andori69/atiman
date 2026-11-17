// @ts-nocheck
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, DoorOpen, Banknote, AlertCircle, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle2, X, CreditCard, ThumbsUp, ThumbsDown,
  Plus, Bell, Copy, Zap, Wrench, UserCheck, Megaphone, CalendarCheck,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency, fmtMoney, timeAgo } from '@/lib/utils'

const GLASS = {
  background: 'rgba(255,255,255,0.22)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.45)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(108,92,231,0.06), 0 1px 1px rgba(255,255,255,0.5) inset',
}

const GLASS_MODAL = {
  background: 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.65)',
  borderRadius: 20,
  boxShadow: '0 24px 64px rgba(100,80,200,0.18)',
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const SOLO_DISCOUNT = 500

function monthKey(y: number, m: number) { return `${y}-${String(m + 1).padStart(2, '0')}` }
function dateKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function calcPerPerson(rent: number, n: number) { return n <= 1 ? rent - SOLO_DISCOUNT : rent / n }
function initials(name: string) { return name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() }
function avatarColor(name: string) {
  const c = ['bg-violet-400','bg-blue-400','bg-emerald-400','bg-amber-400','bg-rose-400','bg-cyan-400','bg-indigo-400','bg-teal-400']
  let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % c.length; return c[h]
}
function modalDateForMonth(y: number, m: number) {
  const now = new Date()
  return (y === now.getFullYear() && m === now.getMonth()) ? now : new Date(y, m + 1, 0)
}
function methodLabel(m: string) {
  return ({ cash:'Cash', gcash:'GCash', bank_transfer:'Bank Transfer', other:'Other' } as any)[m] ?? m
}
function fmtMY(mk: string) {
  const [y, m] = mk.split('-')
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`
}
function urgencyOrder(u: string) { return u === 'high' ? 0 : u === 'medium' ? 1 : 2 }

/* ── Log Payment Modal ── */
function LogPaymentModal({ date, tenants, initialTenantId, onClose, onSaved }: {
  date: Date; tenants: any[]; initialTenantId?: string; onClose: () => void; onSaved: () => void
}) {
  const [tenantId, setTenantId] = useState(initialTenantId ?? '')
  const [method, setMethod] = useState('cash')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sel = tenants.find(t => t.id === tenantId)
  const amount = sel?.per_person_rent ?? 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!sel) return
    setLoading(true); setError('')
    const mk = monthKey(date.getFullYear(), date.getMonth())
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    const ref = `ATM-RT-${code}`
    const { error } = await supabase.from('payments').insert({
      tenant_id: tenantId,
      room_id: sel?.room_id ?? null,
      amount,
      month_year: mk,
      payment_date: dateKey(date),
      payment_method: method,
      status: 'confirmed',
      reference_number: ref,
    })
    if (error) { setError(error.message); setLoading(false); return }
    if (sel?.user_id) {
      const monthLabel = `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`
      await supabase.from('notifications').insert({
        user_id: sel.user_id,
        title: 'Rent Payment Confirmed',
        message: `Your rent payment of ${formatCurrency(amount)} for ${monthLabel} has been confirmed by your landlord. Reference: ${ref}`,
        notification_type: 'payment_confirmed',
        is_read: false,
      })
    }
    onSaved(); onClose()
  }

  const methods = [
    { key: 'cash', label: 'Cash' },
    { key: 'gcash', label: 'GCash' },
    { key: 'bank_transfer', label: 'Bank' },
    { key: 'other', label: 'Other' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm p-6" style={GLASS_MODAL}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[18px] font-bold text-[#1e1b4b]">Log Payment</h2>
            <p className="text-[13px] text-slate-400">{MONTH_NAMES[date.getMonth()]} {date.getFullYear()}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400"
            style={{ background: 'rgba(0,0,0,0.06)' }}>
            <X size={20} />
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 rounded-xl text-[13px] text-red-600">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Renter</label>
            <select value={tenantId} onChange={e => setTenantId(e.target.value)} required
              className="w-full h-11 rounded-xl px-4 text-[15px] text-[#1e1b4b] outline-none appearance-none transition-all"
              style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.08)' }}>
              <option value="">Select renter…</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name}{t.room_number ? ` · Room ${t.room_number}` : ''}</option>)}
            </select>
          </div>

          {sel && (
            <div className="rounded-xl px-4 py-3.5 text-center"
              style={{ background: 'rgba(108,92,231,0.08)', border: '1px solid rgba(108,92,231,0.15)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-400 mb-1">Amount Due</p>
              <p className="text-[28px] font-bold text-[#6C5CE7] tabular-nums leading-none">{formatCurrency(amount)}</p>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Method</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {methods.map(m => (
                <button key={m.key} type="button" onClick={() => setMethod(m.key)}
                  className="h-10 rounded-xl text-[13px] font-semibold transition-all"
                  style={method === m.key ? {
                    background: 'rgba(108,92,231,0.15)', border: '1px solid rgba(108,92,231,0.3)', color: '#6C5CE7',
                  } : {
                    background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)', color: '#64748b',
                  }}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 h-11 rounded-xl font-medium text-[15px] text-slate-500"
              style={{ background: 'rgba(0,0,0,0.06)' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading || !tenantId}
              className="flex-1 h-11 bg-[#6C5CE7] text-white rounded-xl font-semibold text-[15px] disabled:opacity-50 transition-colors"
              style={{ boxShadow: '0 4px 14px rgba(108,92,231,0.35)' }}>
              {loading ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Reminder Detail Modal ── */
async function signedReceiptUrl(stored: string): Promise<string> {
  try {
    const url = new URL(stored)
    const parts = url.pathname.split('/')
    const bucketIdx = parts.findIndex(p => p === 'receipts')
    if (bucketIdx === -1) return stored
    const path = parts.slice(bucketIdx + 1).join('/')
    const { data } = await supabase.storage.from('receipts').createSignedUrl(decodeURIComponent(path), 3600)
    return data?.signedUrl ?? stored
  } catch { return stored }
}

function ReminderDetailModal({ item, onClose, onApprovePayment, onDeclinePayment, onProgressMaint, onResolveMaint, onApproveVisitor, onRejectVisitor, onNavigate, onRemind, onOpenLog, actionLoading, visitorActionLoading, reminderSent, reminderLoading }: {
  item: any; onClose: () => void
  onApprovePayment: (p: any) => void
  onDeclinePayment: (p: any, reason: string) => void
  onProgressMaint: (id: string) => void
  onResolveMaint: (id: string, notes: string) => void
  onApproveVisitor: (v: any) => void
  onRejectVisitor: (v: any, reason: string) => void
  onNavigate: (path: string) => void
  onRemind: (tenant: any, type: 'due' | 'overdue') => void
  onOpenLog: (tenantId: string) => void
  actionLoading: string
  visitorActionLoading: string
  reminderSent: Set<string>
  reminderLoading: string
}) {
  const [showReject, setShowReject] = useState(false)
  const [maintNotes, setMaintNotes] = useState(() => item.data?.landlord_notes ?? '')
  const [receiptSrc, setReceiptSrc] = useState<string | null>(null)

  useEffect(() => {
    if (item.type === 'payment' && item.data?.receipt_url) {
      signedReceiptUrl(item.data.receipt_url).then(u => setReceiptSrc(u))
    }
  }, [item.data?.receipt_url])

  const { type, icon: Icon, iconBg, iconColor, rowBorder, title, data } = item

  const headerBg =
    type === 'payment' ? 'rgba(245,158,11,0.07)'
    : type === 'visitor' ? 'rgba(59,130,246,0.07)'
    : type === 'maintenance' && data?.urgency === 'high' ? 'rgba(255,59,48,0.07)'
    : type === 'maintenance' && data?.urgency === 'medium' ? 'rgba(245,158,11,0.07)'
    : type === 'overdue-single' && data?.months_overdue >= 3 ? 'rgba(255,59,48,0.07)'
    : type === 'overdue-single' ? 'rgba(245,158,11,0.07)'
    : 'rgba(108,92,231,0.07)'

  const typeLabel: Record<string, string> = {
    payment: 'Payment Approval', maintenance: 'Maintenance Request',
    registration: 'New Registration', 'overdue-single': 'Overdue Rent',
    visitor: 'Visitor Notice',
  }

  /* ── small helpers ── */
  function RenterRow({ name, room, avatarUrl }: { name: string; room?: string; avatarUrl?: string | null }) {
    return (
      <div className="flex items-center gap-3 p-3.5 rounded-2xl"
        style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)' }}>
        {avatarUrl
          ? <img src={avatarUrl} alt={name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
          : <div className={`w-10 h-10 rounded-full ${avatarColor(name ?? '')} flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0`}>
              {initials(name ?? '?')}
            </div>
        }
        <div>
          <p className="text-[15px] font-bold text-[#1e1b4b]">{name}</p>
          <p className="text-[12px] text-slate-400">{room ? `Room ${room}` : 'No room'}</p>
        </div>
      </div>
    )
  }

  function Cell({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
    return (
      <div className="rounded-xl p-3" style={accent
        ? { background: 'rgba(108,92,231,0.07)', border: '1px solid rgba(108,92,231,0.12)' }
        : { background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: accent ? '#7c6ce7' : '#94a3b8' }}>{label}</p>
        <p className={`text-[13px] font-semibold leading-tight ${accent ? 'text-[#6C5CE7] text-[18px] tabular-nums' : 'text-[#1e1b4b]'}`}>{value}</p>
        {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    )
  }

  function RejectFlow({ onConfirm, loading }: { onConfirm: (r: string) => void; loading: boolean }) {
    const [localReason, setLocalReason] = useState('')
    if (!showReject) return null
    return (
      <div className="space-y-3 pt-1">
        <textarea value={localReason} onChange={e => setLocalReason(e.target.value)}
          placeholder="Reason (optional)…" rows={2}
          className="w-full rounded-xl px-4 py-3 text-[13px] text-[#1e1b4b] outline-none resize-none"
          style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)' }} />
        <div className="flex gap-2.5">
          <button onClick={() => setShowReject(false)}
            className="flex-1 h-10 rounded-xl text-[13px] font-medium text-slate-500"
            style={{ background: 'rgba(0,0,0,0.05)' }}>Back</button>
          <button onClick={() => onConfirm(localReason)} disabled={loading}
            className="flex-1 h-10 text-white rounded-xl text-[13px] font-semibold disabled:opacity-50"
            style={{ background: 'rgba(239,68,68,0.88)', boxShadow: '0 3px 10px rgba(239,68,68,0.2)' }}>
            {loading ? '…' : 'Confirm'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl max-h-[88vh] flex flex-col overflow-hidden"
        style={GLASS_MODAL}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ background: headerBg, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: iconBg, border: `1px solid ${rowBorder}` }}>
              <Icon size={16} className={iconColor} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{typeLabel[type] ?? type}</p>
              <h2 className="text-[15px] font-bold text-[#1e1b4b] truncate leading-snug">{title}</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 flex-shrink-0 ml-2"
            style={{ background: 'rgba(0,0,0,0.05)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">

          {/* ── PAYMENT ── */}
          {type === 'payment' && (
            <>
              <RenterRow name={data?.tenant?.name} room={data?.tenant?.room?.room_number} avatarUrl={data?.avatar_url} />
              <div className="grid grid-cols-2 gap-2">
                <Cell label="Amount" value={formatCurrency(data?.amount)} accent />
                <Cell label="Period" value={fmtMY(data?.month_year)} />
                <Cell label="Method" value={methodLabel(data?.payment_method)} />
                <Cell label="Submitted"
                  value={data?.created_at ? new Date(data.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + new Date(data.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true }) : '—'}
                  sub={timeAgo(data?.created_at)}
                />
              </div>
              {data?.receipt_url && (
                receiptSrc
                  ? <img src={receiptSrc} alt="Receipt"
                      className="w-full rounded-xl object-cover cursor-zoom-in"
                      style={{ maxHeight: 220 }}
                      onClick={() => window.open(receiptSrc, '_blank')} />
                  : <div className="w-full h-24 rounded-xl animate-pulse" style={{ background: 'rgba(0,0,0,0.06)' }} />
              )}
              {data?.notes && (
                <div className="rounded-xl px-3.5 py-3"
                  style={{ background: 'rgba(108,92,231,0.05)', border: '1px solid rgba(108,92,231,0.1)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-1">Notes</p>
                  <p className="text-[12px] text-slate-600 italic">"{data.notes}"</p>
                </div>
              )}
              {!showReject ? (
                <div className="flex gap-2.5 pt-1">
                  <button onClick={() => { onApprovePayment(data); onClose() }}
                    disabled={actionLoading === data?.id}
                    className="flex-1 h-11 text-white rounded-xl text-[14px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                    style={{ background: 'rgba(16,185,129,0.88)', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}>
                    <ThumbsUp size={14} /> {actionLoading === data?.id ? 'Approving…' : 'Approve'}
                  </button>
                  <button onClick={() => setShowReject(true)}
                    className="flex-1 h-11 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-1.5"
                    style={{ background: 'rgba(255,59,48,0.07)', color: '#ef4444', border: '1px solid rgba(255,59,48,0.15)' }}>
                    <ThumbsDown size={14} /> Decline
                  </button>
                </div>
              ) : (
                <RejectFlow onConfirm={(r) => { onDeclinePayment(data, r); onClose() }} loading={actionLoading === data?.id} />
              )}
            </>
          )}

          {/* ── MAINTENANCE ── */}
          {type === 'maintenance' && (
            <>
              <RenterRow name={data?.tenant?.name} room={data?.tenant?.room?.room_number} avatarUrl={data?.avatar_url} />
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl p-2.5 text-center"
                  style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Category</p>
                  <p className="text-[11px] font-semibold text-[#1e1b4b] capitalize">{data?.category}</p>
                </div>
                <div className="rounded-xl p-2.5 text-center"
                  style={data?.urgency === 'high'
                    ? { background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.15)' }
                    : data?.urgency === 'medium'
                    ? { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }
                    : { background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Urgency</p>
                  <p className={`text-[11px] font-bold capitalize ${data?.urgency === 'high' ? 'text-red-500' : data?.urgency === 'medium' ? 'text-amber-500' : 'text-blue-500'}`}>
                    {data?.urgency}
                  </p>
                </div>
                <div className="rounded-xl p-2.5 text-center"
                  style={data?.status === 'in_progress'
                    ? { background: 'rgba(108,92,231,0.08)', border: '1px solid rgba(108,92,231,0.15)' }
                    : { background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Status</p>
                  <p className={`text-[11px] font-semibold ${data?.status === 'in_progress' ? 'text-violet-500' : 'text-slate-400'}`}>
                    {data?.status === 'in_progress' ? 'In Progress' : 'Pending'}
                  </p>
                </div>
              </div>
              <div className="rounded-xl p-3.5" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Description</p>
                <p className="text-[13px] text-[#1e1b4b] leading-relaxed">{data?.description}</p>
              </div>
              {data?.photos?.[0] && (
                <img src={data.photos[0]} alt="" className="w-full rounded-xl object-cover" style={{ maxHeight: 140 }} />
              )}
              <p className="text-[11px] text-slate-400">{timeAgo(data?.created_at)}</p>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Response / Notes</p>
                <textarea value={maintNotes} onChange={e => setMaintNotes(e.target.value)}
                  placeholder="Optional message for the renter…" rows={2}
                  className="w-full rounded-xl px-4 py-3 text-[13px] text-[#1e1b4b] outline-none resize-none"
                  style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)' }} />
              </div>
              <div className="flex gap-2.5">
                {data?.status === 'pending' && (
                  <button onClick={() => { onProgressMaint(data.id); onClose() }} disabled={actionLoading === data?.id}
                    className="flex-1 h-11 rounded-xl text-[13px] font-semibold disabled:opacity-50"
                    style={{ background: 'rgba(108,92,231,0.1)', color: '#6C5CE7', border: '1px solid rgba(108,92,231,0.18)' }}>
                    {actionLoading === data?.id ? '…' : 'In Progress'}
                  </button>
                )}
                <button onClick={() => { onResolveMaint(data.id, maintNotes); onClose() }} disabled={actionLoading === data?.id}
                  className="flex-1 h-11 text-white rounded-xl text-[13px] font-semibold disabled:opacity-50"
                  style={{ background: 'rgba(16,185,129,0.88)', boxShadow: '0 3px 10px rgba(16,185,129,0.2)' }}>
                  {actionLoading === data?.id ? '…' : 'Mark Resolved'}
                </button>
              </div>
            </>
          )}

          {/* ── VISITOR ── */}
          {type === 'visitor' && (
            <>
              <RenterRow name={data?.tenant?.name} room={data?.tenant?.room?.room_number} avatarUrl={data?.avatar_url} />
              <div className="grid grid-cols-2 gap-2">
                <Cell label="Visitors" value={`${data?.visitor_count ?? 1} ${(data?.visitor_count ?? 1) === 1 ? 'person' : 'people'}`} />
                <Cell label="Relationship" value={data?.relationship ?? '—'} />
                <Cell label="Date" value={fmtDate(data?.visit_date)} />
                <Cell label="Time" value={fmt12vis(data?.visit_time)} />
              </div>
              {data?.purpose && (
                <div className="rounded-xl px-3.5 py-3"
                  style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.12)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-1">Purpose</p>
                  <p className="text-[13px] text-[#1e1b4b]">{data.purpose}</p>
                </div>
              )}
              <p className="text-[11px] text-slate-400">{timeAgo(data?.created_at)}</p>
              {!showReject ? (
                <div className="flex gap-2.5 pt-1">
                  <button onClick={() => { onApproveVisitor(data); onClose() }}
                    disabled={visitorActionLoading === data?.id}
                    className="flex-1 h-11 text-white rounded-xl text-[14px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                    style={{ background: 'rgba(16,185,129,0.88)', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}>
                    <ThumbsUp size={14} /> {visitorActionLoading === data?.id ? 'Approving…' : 'Approve'}
                  </button>
                  <button onClick={() => setShowReject(true)}
                    className="flex-1 h-11 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-1.5"
                    style={{ background: 'rgba(255,59,48,0.07)', color: '#ef4444', border: '1px solid rgba(255,59,48,0.15)' }}>
                    <ThumbsDown size={14} /> Reject
                  </button>
                </div>
              ) : (
                <RejectFlow onConfirm={(r) => { onRejectVisitor(data, r); onClose() }} loading={visitorActionLoading === data?.id} />
              )}
            </>
          )}

          {/* ── REGISTRATION ── */}
          {type === 'registration' && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.18)' }}>
                  <UserCheck size={18} className="text-violet-500" />
                </div>
                <div>
                  <p className="text-[17px] font-bold text-[#1e1b4b]">{data?.count} Pending Registration{data?.count !== 1 ? 's' : ''}</p>
                  <p className="text-[12px] text-slate-400">Awaiting room assignment and approval</p>
                </div>
              </div>
              {(data?.regs ?? []).length > 0 && (
                <div className="space-y-2 mb-4 max-h-[260px] overflow-y-auto">
                  {(data.regs ?? []).map((reg: any, i: number) => (
                    <div key={reg.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: i % 2 === 0 ? 'rgba(108,92,231,0.04)' : 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
                        style={{ background: '#6C5CE7' }}>
                        {(reg.full_name?.[0] ?? '?').toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-[#1e1b4b] truncate">{reg.full_name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{reg.email ?? reg.phone ?? '—'}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">{timeAgo(reg.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => { onNavigate('/landlord/registrations'); onClose() }}
                className="w-full h-11 text-white rounded-xl font-semibold text-[14px]"
                style={{ background: '#6C5CE7', boxShadow: '0 4px 14px rgba(108,92,231,0.35)' }}>
                Review & Approve →
              </button>
            </div>
          )}

          {/* ── OVERDUE SINGLE ── */}
          {type === 'overdue-single' && (
            <>
              <RenterRow name={data?.name} room={data?.room_number} avatarUrl={data?.avatar_url} />
              <div className="grid grid-cols-2 gap-2">
                <Cell label="Months Overdue" value={`${data?.months_overdue} month${data?.months_overdue !== 1 ? 's' : ''}`} />
                <Cell label="Total Due" value={formatCurrency(data?.months_overdue * data?.per_person_rent)} accent />
              </div>
              {data?.user_id && (
                <button onClick={() => { onRemind(data, 'overdue'); onClose() }}
                  disabled={reminderLoading === data?.id}
                  className="w-full h-11 rounded-xl font-semibold text-[14px] disabled:opacity-50 transition-all"
                  style={reminderSent?.has(data?.id)
                    ? { background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.2)' }
                    : { background: 'rgba(255,59,48,0.08)', color: '#ef4444', border: '1px solid rgba(255,59,48,0.15)' }}>
                  {reminderLoading === data?.id ? '…' : reminderSent?.has(data?.id) ? '✓ Reminder Sent' : 'Send Overdue Reminder'}
                </button>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  )
}

/* ── Quick Announce Modal ── */
const ANN_PRIORITIES = ['urgent', 'important', 'regular'] as const
const ANN_PRI_CFG = {
  urgent:   { label: 'Urgent',       color: '#dc2626', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)'   },
  important:{ label: 'Important',    color: '#d97706', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)'  },
  regular:  { label: 'Announcement', color: '#6C5CE7', bg: 'rgba(108,92,231,0.1)', border: 'rgba(108,92,231,0.25)'  },
}
function QuickAnnounceModal({ onClose, onSaved, landlordId }: { onClose: () => void; onSaved: () => void; landlordId: string }) {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [priority, setPriority] = useState<'urgent'|'important'|'regular'>('regular')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !message.trim()) return
    setSaving(true); setErr('')
    const { error } = await supabase.from('announcements').insert({
      landlord_id: landlordId,
      title: title.trim(), message: message.trim(),
      priority, is_pinned: priority === 'urgent', target_buildings: null,
    })
    if (error) { setErr(error.message); setSaving(false); return }
    const { data: renters } = await supabase.from('profiles').select('id')
      .eq('linked_landlord_id', landlordId).eq('role', 'renter').eq('status', 'approved')
    if (renters?.length) {
      const emoji = priority === 'urgent' ? '🚨' : priority === 'important' ? '⚠️' : '📢'
      await supabase.from('notifications').insert(
        renters.map((r: any) => ({
          user_id: r.id, title: `${emoji} ${title.trim()}`,
          message: message.trim().slice(0, 120), notification_type: 'announcement',
        }))
      )
    }
    onSaved(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 -4px 40px rgba(0,0,0,0.15)' }}>
        <div className="w-10 h-1 rounded-full mx-auto mt-3 sm:hidden" style={{ background: 'rgba(0,0,0,0.12)' }} />
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(108,92,231,0.1)' }}>
              <Megaphone size={15} className="text-violet-500" />
            </div>
            <h2 className="text-[17px] font-bold text-[#1e1b4b]">New Announcement</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400" style={{ background: 'rgba(0,0,0,0.05)' }}><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {err && <p className="text-[13px] text-red-500 bg-red-50 rounded-xl px-3 py-2">{err}</p>}
          <div className="flex gap-2">
            {ANN_PRIORITIES.map(p => {
              const cfg = ANN_PRI_CFG[p]; const active = priority === p
              return (
                <button key={p} type="button" onClick={() => setPriority(p)}
                  className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold transition-all"
                  style={active ? { background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }
                    : { background: 'rgba(0,0,0,0.04)', color: '#94a3b8', border: '1px solid transparent' }}>
                  {cfg.label}
                </button>
              )
            })}
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="Announcement title…"
              className="w-full h-11 rounded-xl px-4 text-[15px] text-[#1e1b4b] outline-none"
              style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)' }} />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Message *</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} required rows={4}
              placeholder="Write your message here…"
              className="w-full rounded-xl px-4 py-3 text-[15px] text-[#1e1b4b] outline-none resize-none"
              style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)' }} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 h-11 rounded-xl font-semibold text-[15px] text-[#1e1b4b]"
              style={{ background: 'rgba(0,0,0,0.06)' }}>Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 h-11 rounded-xl font-semibold text-[15px] text-white disabled:opacity-50"
              style={{ background: '#6C5CE7', boxShadow: '0 4px 12px rgba(108,92,231,0.3)' }}>
              {saving ? 'Posting…' : 'Post Announcement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Main Dashboard ── */
export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const now = new Date()

  const [loading, setLoading] = useState(true)
  const [boardingHouseName, setBoardingHouseName] = useState('')
  const [collected, setCollected] = useState(0)
  const [paidCount, setPaidCount] = useState(0)
  const [totalEligible, setTotalEligible] = useState(0)
  const [renterCount, setRenterCount] = useState(0)
  const [roomCount, setRoomCount] = useState(0)

  const [tenants, setTenants] = useState<any[]>([])
  const [unpaid, setUnpaid] = useState<any[]>([])
  const [overdue, setOverdue] = useState<any[]>([])
  const [electricityShares, setElectricityShares] = useState<any[]>([])
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [maintenanceItems, setMaintenanceItems] = useState<any[]>([])
  const [registrationCount, setRegistrationCount] = useState(0)
  const [pendingRegs, setPendingRegs] = useState<any[]>([])
  const [visitorItems, setVisitorItems] = useState<any[]>([])
  const [visitorActionLoading, setVisitorActionLoading] = useState('')

  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [logDate, setLogDate] = useState<Date | null>(null)
  const [quickLogTenant, setQuickLogTenant] = useState<string | undefined>()

  const [actionLoading, setActionLoading] = useState('')
  const [copied, setCopied] = useState(false)
  const [selectedReminder, setSelectedReminder] = useState<any>(null)
  const [reminderSent, setReminderSent] = useState<Set<string>>(new Set())
  const [reminderLoading, setReminderLoading] = useState('')
  const [elecReminderSent, setElecReminderSent] = useState<Set<string>>(new Set())
  const [elecReminderLoading, setElecReminderLoading] = useState('')
  const [remindAllRentLoading, setRemindAllRentLoading]   = useState(false)
  const [remindAllRentSent,    setRemindAllRentSent]       = useState(false)
  const [remindAllElecLoading, setRemindAllElecLoading]   = useState(false)
  const [remindAllElecSent,    setRemindAllElecSent]       = useState(false)
  const [showAnnounceModal, setShowAnnounceModal] = useState(false)

  useEffect(() => { init() }, [calYear, calMonth])

  useEffect(() => {
    const channel = supabase.channel('dashboard-visitor-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'visitor_requests' }, () => { init() })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'visitor_requests' }, () => { init() })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'payments' }, () => { init() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function init() {
    setLoading(true)

    const { data: buildings } = await supabase.from('buildings').select('id, name').eq('landlord_id', profile!.id)
    if (!buildings?.length) { setLoading(false); return }
    const buildingIds = buildings.map((b: any) => b.id)
    setBoardingHouseName(buildings[0]?.name ?? '')

    const calMK = monthKey(calYear, calMonth)

    // Pre-fetch rooms to derive isolated roomIds + tenantIds — all downstream queries filter by these
    const { data: roomsOcc } = await supabase
      .from('rooms')
      .select('id, tenants(id, is_active, occupants)')
      .in('building_id', buildingIds)

    const roomIds: string[] = (roomsOcc ?? []).map((r: any) => r.id)
    const roomOccMap = new Map<string, number>()
    const tenantIds: string[] = []
    for (const r of roomsOcc ?? []) {
      const active = (r.tenants ?? []).filter((t: any) => t.is_active)
      roomOccMap.set(r.id, active.reduce((s: number, t: any) => s + (t.occupants ?? 1), 0))
      for (const t of active) tenantIds.push(t.id)
    }
    setRenterCount(tenantIds.length)
    setRoomCount(roomIds.length)

    const [
      { data: tenantsRaw },
      { data: calPayments },
      { data: confirmedPayments },
      { data: pendingData },
      { data: maintData },
      { count: regCount, data: regsData },
      { data: elecBills },
      { data: visitorData },
    ] = await Promise.all([
      // Only this landlord's active tenants
      roomIds.length
        ? supabase.from('tenants').select('id, name, user_id, room_id, move_in_date, room:rooms(id, room_number, rent_amount)').in('room_id', roomIds).eq('is_active', true)
        : Promise.resolve({ data: [] }),
      // Calendar payments for this landlord's tenants only
      tenantIds.length
        ? supabase.from('payments').select('amount, status, tenant_id').eq('month_year', calMK).in('tenant_id', tenantIds)
        : Promise.resolve({ data: [] }),
      // All confirmed payments for overdue calc — this landlord's tenants only
      tenantIds.length
        ? supabase.from('payments').select('tenant_id, month_year').in('status', ['confirmed', 'verified']).in('tenant_id', tenantIds)
        : Promise.resolve({ data: [] }),
      // Pending payments — this landlord's tenants only
      tenantIds.length
        ? supabase.from('payments').select('id, amount, month_year, payment_method, notes, receipt_url, created_at, tenant:tenants(id, name, user_id, room:rooms(room_number))').eq('status', 'pending').in('tenant_id', tenantIds).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      // Maintenance — this landlord's rooms only
      roomIds.length
        ? supabase.from('maintenance_requests').select('id, category, description, urgency, status, created_at, landlord_notes, tenant:tenants(id, name, user_id, room:rooms(room_number))').in('status', ['pending', 'in_progress']).in('room_id', roomIds).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      supabase.from('profiles').select('id, full_name, email, phone, created_at', { count: 'exact' }).eq('status', 'pending').eq('linked_landlord_id', profile!.id),
      supabase.from('electricity_bills').select('id').in('building_id', buildingIds).eq('month_year', calMK),
      // Visitor requests — this landlord's rooms only
      roomIds.length
        ? supabase.from('visitor_requests').select('id, visitor_count, relationship, visit_date, visit_time, purpose, status, created_at, tenant:tenants(id, name, user_id, room:rooms(room_number, building_id))').eq('status', 'pending').in('room_id', roomIds).order('visit_date', { ascending: true })
        : Promise.resolve({ data: [] }),
    ])

    const baseEnriched = (tenantsRaw ?? []).map((t: any) => {
      const count = t.room_id ? (roomOccMap.get(t.room_id) ?? 1) : 1
      return { ...t, room_number: t.room?.room_number ?? null, per_person_rent: t.room ? calcPerPerson(t.room.rent_amount, count) : 0 }
    })

    // Collect all user_ids across tenants + action center items for one batch profile fetch
    const allUserIds = new Set<string>([
      ...baseEnriched.map((t: any) => t.user_id),
      ...(pendingData ?? []).map((p: any) => p.tenant?.user_id),
      ...(maintData ?? []).map((m: any) => m.tenant?.user_id),
      ...(visitorData ?? []).map((v: any) => v.tenant?.user_id),
    ].filter(Boolean))

    let profileAvatarMap: Record<string, string | null> = {}
    if (allUserIds.size) {
      const { data: profs } = await supabase.from('profiles').select('id, avatar_url').in('id', [...allUserIds])
      profileAvatarMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.avatar_url ?? null]))
    }

    const enriched = baseEnriched.map((t: any) => ({ ...t, avatar_url: profileAvatarMap[t.user_id ?? ''] ?? null }))
    setTenants(enriched)

    const confirmedCal = (calPayments ?? []).filter((p: any) => p.status === 'confirmed' || p.status === 'verified')
    const paidIds = new Set<string>(confirmedCal.map((p: any) => p.tenant_id))
    setCollected(confirmedCal.reduce((s: number, p: any) => s + p.amount, 0))

    function isEligible(t: any) {
      if (!t.room_id) return false
      if (!t.move_in_date) return true
      const mi = new Date(t.move_in_date)
      return calMK >= monthKey(mi.getFullYear(), mi.getMonth())
    }

    const eligible = enriched.filter(isEligible)
    setPaidCount(eligible.filter((t: any) => paidIds.has(t.id)).length)
    setTotalEligible(eligible.length)
    setUnpaid(eligible.filter((t: any) => !paidIds.has(t.id)))

    const confirmedSet = new Set<string>((confirmedPayments ?? []).map((p: any) => `${p.tenant_id}__${p.month_year}`))
    // Pending payments also block overdue: a month with a pending submission is NOT overdue yet
    const pendingPaySet = new Set<string>(
      (pendingData ?? []).map((p: any) => {
        const tid = p.tenant?.id
        return tid ? `${tid}__${p.month_year}` : null
      }).filter(Boolean) as string[]
    )
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const overdueList = enriched
      .map((t: any) => {
        if (!t.move_in_date || !t.room) return null
        const mi = new Date(t.move_in_date)
        let months = 0
        const d = new Date(mi.getFullYear(), mi.getMonth(), 1)
        while (d <= lastMonth) {
          const key = `${t.id}__${monthKey(d.getFullYear(), d.getMonth())}`
          if (!confirmedSet.has(key) && !pendingPaySet.has(key)) months++
          d.setMonth(d.getMonth() + 1)
        }
        return months > 0 ? { ...t, months_overdue: months } : null
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.months_overdue - a.months_overdue)
    setOverdue(overdueList)

    function injectAvatar(item: any) {
      const uid = item.tenant?.user_id ?? item.user_id ?? null
      return { ...item, avatar_url: profileAvatarMap[uid] ?? null }
    }

    setPendingRequests((pendingData ?? []).map(injectAvatar))
    setMaintenanceItems(
      (maintData ?? [])
        .sort((a: any, b: any) => urgencyOrder(a.urgency) - urgencyOrder(b.urgency))
        .map(injectAvatar)
    )
    setRegistrationCount(regCount ?? 0)
    setPendingRegs(regsData ?? [])
    setVisitorItems((visitorData ?? []).map(injectAvatar))

    // Electricity shares — only show tenants who haven't paid yet
    const billIds = (elecBills ?? []).map((b: any) => b.id)
    if (billIds.length > 0) {
      const [{ data: sharesData }, { data: paidElecData }] = await Promise.all([
        supabase.from('electricity_shares')
          .select('share_amount, is_paid, tenant:tenants(id, user_id, name, room:rooms(room_number))')
          .in('bill_id', billIds),
        // confirmed electricity payments this month for this landlord's tenants
        tenantIds.length
          ? supabase.from('payments')
              .select('tenant_id')
              .in('tenant_id', tenantIds)
              .eq('month_year', calMK)
              .in('status', ['confirmed', 'verified'])
              .ilike('notes', 'Electricity%')
          : Promise.resolve({ data: [] }),
      ])
      const paidTenantIds = new Set((paidElecData ?? []).map((p: any) => p.tenant_id))
      setElectricityShares(
        (sharesData ?? [])
          .filter((s: any) => !s.is_paid && !paidTenantIds.has(s.tenant?.id))
          .map((s: any) => ({
            tenant_id: s.tenant?.id,
            user_id: s.tenant?.user_id ?? null,
            name: s.tenant?.name ?? '—',
            room_number: s.tenant?.room?.room_number ?? null,
            amount: s.share_amount,
          }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name))
      )
    } else {
      setElectricityShares([])
    }

    setLoading(false)
  }

  async function approvePayment(payment: any) {
    setActionLoading(payment.id)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    const isElec = (payment.notes ?? '').toLowerCase().startsWith('electricity')
    const referenceNumber = isElec ? `ATM-EL-${code}` : `ATM-RT-${code}`
    await supabase.from('payments').update({ status: 'confirmed', verified_by: profile!.id, reference_number: referenceNumber }).eq('id', payment.id)
    if (payment.tenant?.user_id) {
      await supabase.from('notifications').insert({
        user_id: payment.tenant.user_id,
        title: 'Payment Confirmed',
        message: `Your payment of ${formatCurrency(payment.amount)} for ${fmtMY(payment.month_year)} has been confirmed. Reference: ${referenceNumber}`,
        notification_type: 'payment_confirmed', is_read: false,
      })
    }
    setPendingRequests((prev: any[]) => prev.filter((p: any) => p.id !== payment.id))
    setActionLoading(''); init()
  }

  async function declinePayment(payment: any, reason: string) {
    setActionLoading(payment.id)
    await supabase.from('payments').update({ status: 'rejected', rejection_reason: reason || null }).eq('id', payment.id)
    if (payment.tenant?.user_id) {
      await supabase.from('notifications').insert({
        user_id: payment.tenant.user_id,
        title: 'Payment Declined',
        message: `Your payment for ${fmtMY(payment.month_year)} was declined.${reason ? ` Reason: ${reason}` : ''}`,
        notification_type: 'payment_rejected', is_read: false,
      })
    }
    setPendingRequests((prev: any[]) => prev.filter((p: any) => p.id !== payment.id))
    setActionLoading(''); setSelectedReminder(null); init()
  }

  async function resolveMaintenance(id: string, notes?: string) {
    setActionLoading(id)
    const update: any = { status: 'resolved', updated_at: new Date().toISOString() }
    if (notes) update.landlord_notes = notes
    await supabase.from('maintenance_requests').update(update).eq('id', id)
    const mItem = maintenanceItems.find((m: any) => m.id === id)
    if (mItem?.tenant?.user_id) {
      await supabase.from('notifications').insert({
        user_id: mItem.tenant.user_id,
        title: 'Maintenance Resolved',
        message: `Your maintenance request has been resolved.${notes ? ` Note: ${notes}` : ''}`,
        notification_type: 'maintenance_update', is_read: false,
      })
    }
    setActionLoading(''); init()
  }

  async function progressMaintenance(id: string) {
    setActionLoading(id)
    await supabase.from('maintenance_requests').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', id)
    const mItem = maintenanceItems.find((m: any) => m.id === id)
    if (mItem?.tenant?.user_id) {
      await supabase.from('notifications').insert({
        user_id: mItem.tenant.user_id,
        title: 'Maintenance In Progress',
        message: `Your maintenance request is now being worked on.`,
        notification_type: 'maintenance_update', is_read: false,
      })
    }
    setActionLoading(''); init()
  }

  async function sendRentReminder(tenant: any, type: 'due' | 'overdue') {
    if (!tenant.user_id || reminderLoading === tenant.id) return
    setReminderLoading(tenant.id)
    const monthLabel = `${MONTH_NAMES[calMonth]} ${calYear}`
    const title = type === 'due' ? 'Rent Reminder' : 'Overdue Rent Notice'
    const message = type === 'due'
      ? `Your rent of ${formatCurrency(tenant.per_person_rent)} for ${monthLabel} is still unpaid. Please settle your payment as soon as possible.`
      : `You have ${tenant.months_overdue} month${tenant.months_overdue !== 1 ? 's' : ''} of overdue rent totaling ${formatCurrency(tenant.months_overdue * tenant.per_person_rent)}. Please settle your outstanding balance as soon as possible.`
    await supabase.from('notifications').insert({
      user_id: tenant.user_id, title, message,
      notification_type: type === 'due' ? 'rent_reminder' : 'rent_overdue',
      is_read: false,
    })
    setReminderLoading('')
    setReminderSent(prev => new Set([...prev, tenant.id]))
    setTimeout(() => setReminderSent(prev => { const n = new Set(prev); n.delete(tenant.id); return n }), 4000)
  }

  async function sendElecReminder(share: any) {
    if (!share.user_id || elecReminderLoading === share.tenant_id) return
    setElecReminderLoading(share.tenant_id)
    const monthLabel = `${MONTH_NAMES[calMonth]} ${calYear}`
    await supabase.from('notifications').insert({
      user_id: share.user_id,
      title: 'Electricity Bill Reminder',
      message: `Your electricity bill for ${monthLabel} is ${formatCurrency(share.amount)}. Please settle your payment as soon as possible.`,
      notification_type: 'electricity_reminder',
      is_read: false,
    })
    setElecReminderLoading('')
    setElecReminderSent(prev => new Set([...prev, share.tenant_id]))
    setTimeout(() => setElecReminderSent(prev => { const n = new Set(prev); n.delete(share.tenant_id); return n }), 4000)
  }

  async function sendAllRentReminders() {
    const targets = unpaid.filter((t: any) => t.user_id)
    if (!targets.length || remindAllRentLoading) return
    setRemindAllRentLoading(true)
    const monthLabel = `${MONTH_NAMES[calMonth]} ${calYear}`
    await supabase.from('notifications').insert(
      targets.map((t: any) => ({
        user_id: t.user_id,
        title: 'Rent Reminder',
        message: `Your rent of ${formatCurrency(t.per_person_rent)} for ${monthLabel} is still unpaid. Please settle your payment as soon as possible.`,
        notification_type: 'rent_reminder',
        is_read: false,
      }))
    )
    setRemindAllRentLoading(false)
    setRemindAllRentSent(true)
    setReminderSent(new Set(targets.map((t: any) => t.id)))
    setTimeout(() => { setRemindAllRentSent(false); setReminderSent(new Set()) }, 4000)
  }

  async function sendAllElecReminders() {
    const targets = electricityShares.filter((s: any) => s.user_id)
    if (!targets.length || remindAllElecLoading) return
    setRemindAllElecLoading(true)
    const monthLabel = `${MONTH_NAMES[calMonth]} ${calYear}`
    await supabase.from('notifications').insert(
      targets.map((s: any) => ({
        user_id: s.user_id,
        title: 'Electricity Bill Reminder',
        message: `Your electricity bill for ${monthLabel} is ${formatCurrency(s.amount)}. Please settle your payment as soon as possible.`,
        notification_type: 'electricity_reminder',
        is_read: false,
      }))
    )
    setRemindAllElecLoading(false)
    setRemindAllElecSent(true)
    setElecReminderSent(new Set(targets.map((s: any) => s.tenant_id)))
    setTimeout(() => { setRemindAllElecSent(false); setElecReminderSent(new Set()) }, 4000)
  }

  function fmtDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  function fmt12vis(t: string) {
    if (!t) return ''
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    return `${((h % 12) || 12)}:${String(m).padStart(2, '0')} ${ampm}`
  }

  async function approveVisitorDash(visitor: any) {
    setVisitorActionLoading(visitor.id)
    await supabase.from('visitor_requests').update({ status: 'approved' }).eq('id', visitor.id)
    if (visitor.tenant?.user_id) {
      await supabase.from('notifications').insert({
        user_id: visitor.tenant.user_id,
        title: 'Visitor Approved',
        message: `Your visitor notice for ${visitor.visitor_count ?? 1} ${(visitor.visitor_count ?? 1) === 1 ? 'person' : 'people'} on ${fmtDate(visitor.visit_date)} at ${fmt12vis(visitor.visit_time)} has been approved. Please remind your visitor(s) to check in at the gate upon arrival.`,
        notification_type: 'visitor_approved', is_read: false,
      })
    }
    setVisitorActionLoading(''); init()
  }

  async function rejectVisitorDash(visitor: any, reason: string) {
    setVisitorActionLoading(visitor.id)
    await supabase.from('visitor_requests').update({ status: 'rejected', rejection_reason: reason || null }).eq('id', visitor.id)
    if (visitor.tenant?.user_id) {
      await supabase.from('notifications').insert({
        user_id: visitor.tenant.user_id,
        title: 'Visitor Rejected',
        message: `Your visitor notice for ${fmtDate(visitor.visit_date)} at ${fmt12vis(visitor.visit_time)} was not approved.${reason ? ` Reason: ${reason}` : ''}`,
        notification_type: 'visitor_rejected', is_read: false,
      })
    }
    setVisitorActionLoading(''); init()
  }

  function prevMonth() { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) } else setCalMonth(m => m - 1) }
  function nextMonth() { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) } else setCalMonth(m => m + 1) }
  function openQuickLog(tenantId?: string) {
    setQuickLogTenant(tenantId)
    setLogDate(modalDateForMonth(calYear, calMonth))
  }
  function copyCode() {
    navigator.clipboard.writeText(profile?.landlord_code ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Landlord'
  const isCurrentMonth = calYear === now.getFullYear() && calMonth === now.getMonth()

  /* ── Reminder items — Priority order: Approvals → Alerts ── */
  type ReminderItem = {
    id: string; type: string; icon: React.ElementType
    rowBg: string; rowBorder: string
    iconBg: string; iconColor: string
    title: string; subtitle: string; badge: string; badgeBg: string; badgeColor: string
    data?: any
  }
  const reminderItems: ReminderItem[] = []

  // 1. APPROVAL REQUESTS — pending payments (rent + electricity)
  pendingRequests.forEach((req: any) => {
    const isElec = (req.notes ?? '').toLowerCase().startsWith('electricity')
    reminderItems.push({
      id: `pay-${req.id}`, type: 'payment', icon: CreditCard,
      rowBg: 'rgba(245,158,11,0.07)', rowBorder: 'rgba(245,158,11,0.5)',
      iconBg: 'rgba(245,158,11,0.12)', iconColor: 'text-amber-500',
      title: req.tenant?.name ?? 'Renter',
      subtitle: `${formatCurrency(req.amount)} · ${fmtMY(req.month_year)} · ${methodLabel(req.payment_method)}`,
      badge: isElec ? 'Electricity' : 'Rent',
      badgeBg: 'rgba(245,158,11,0.14)', badgeColor: '#d97706',
      data: req,
    })
  })

  // 2. APPROVAL REQUESTS — pending registrations
  if (registrationCount > 0) {
    reminderItems.push({
      id: 'registrations', type: 'registration', icon: UserCheck,
      rowBg: 'rgba(108,92,231,0.07)', rowBorder: 'rgba(108,92,231,0.5)',
      iconBg: 'rgba(108,92,231,0.12)', iconColor: 'text-violet-500',
      title: `${registrationCount} New Registration${registrationCount !== 1 ? 's' : ''}`,
      subtitle: 'Awaiting your review and room assignment',
      badge: `${registrationCount} Pending`, badgeBg: 'rgba(108,92,231,0.12)', badgeColor: '#6C5CE7',
      data: { count: registrationCount, regs: pendingRegs },
    })
  }

  // 3. APPROVAL REQUESTS — pending visitor notices
  visitorItems.forEach((v: any) => {
    reminderItems.push({
      id: `visitor-${v.id}`, type: 'visitor', icon: CalendarCheck,
      rowBg: 'rgba(59,130,246,0.06)', rowBorder: 'rgba(59,130,246,0.45)',
      iconBg: 'rgba(59,130,246,0.1)', iconColor: 'text-blue-500',
      title: `${v.visitor_count ?? 1} visitor${(v.visitor_count ?? 1) !== 1 ? 's' : ''}${v.relationship ? ` (${v.relationship})` : ''}`,
      subtitle: `${v.tenant?.name ?? 'Renter'}${v.tenant?.room?.room_number ? ` · Room ${v.tenant.room.room_number}` : ''} · ${fmtDate(v.visit_date)} at ${fmt12vis(v.visit_time)}`,
      badge: 'Visitor Notice', badgeBg: 'rgba(59,130,246,0.1)', badgeColor: '#3b82f6',
      data: v,
    })
  })

  // 4. ALERTS — overdue rent (one card per renter)
  overdue.forEach((t: any) => {
    reminderItems.push({
      id: `overdue-${t.id}`, type: 'overdue-single', icon: AlertTriangle,
      rowBg: t.months_overdue >= 3 ? 'rgba(255,59,48,0.08)' : 'rgba(245,158,11,0.07)',
      rowBorder: t.months_overdue >= 3 ? 'rgba(255,59,48,0.5)' : 'rgba(245,158,11,0.5)',
      iconBg: t.months_overdue >= 3 ? 'rgba(255,59,48,0.12)' : 'rgba(245,158,11,0.12)',
      iconColor: t.months_overdue >= 3 ? 'text-red-500' : 'text-amber-500',
      title: t.name,
      subtitle: `${t.room_number ? `Room ${t.room_number} · ` : ''}${t.months_overdue} month${t.months_overdue !== 1 ? 's' : ''} overdue`,
      badge: `${t.months_overdue}mo Overdue`,
      badgeBg: t.months_overdue >= 3 ? 'rgba(255,59,48,0.12)' : 'rgba(245,158,11,0.12)',
      badgeColor: t.months_overdue >= 3 ? '#ef4444' : '#d97706',
      data: t,
    })
  })

  // 5. ALERTS — maintenance requests
  maintenanceItems.forEach((m: any) => {
    const isHigh = m.urgency === 'high', isMed = m.urgency === 'medium'
    reminderItems.push({
      id: `maint-${m.id}`, type: 'maintenance', icon: Wrench,
      rowBg: isHigh ? 'rgba(255,59,48,0.07)' : isMed ? 'rgba(245,158,11,0.07)' : 'rgba(59,130,246,0.06)',
      rowBorder: isHigh ? 'rgba(255,59,48,0.5)' : isMed ? 'rgba(245,158,11,0.5)' : 'rgba(59,130,246,0.5)',
      iconBg: isHigh ? 'rgba(255,59,48,0.12)' : isMed ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.1)',
      iconColor: isHigh ? 'text-red-500' : isMed ? 'text-amber-500' : 'text-blue-500',
      title: m.tenant?.name ?? 'Renter',
      subtitle: `${m.category ? m.category.charAt(0).toUpperCase() + m.category.slice(1) : 'Issue'}${m.tenant?.room?.room_number ? ` · Room ${m.tenant.room.room_number}` : ''} · ${timeAgo(m.created_at)}`,
      badge: isHigh ? 'Urgent' : isMed ? 'Medium' : 'Low',
      badgeBg: isHigh ? 'rgba(255,59,48,0.12)' : isMed ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.1)',
      badgeColor: isHigh ? '#ef4444' : isMed ? '#d97706' : '#3b82f6',
      data: m,
    })
  })

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-end justify-between pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.3)' }}>
          <div className="space-y-2">
            <div className="h-4 w-40 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.35)' }} />
            <div className="h-8 w-32 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.35)' }} />
          </div>
          <div className="h-10 w-28 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.35)' }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.25)' }} />)}
        </div>
        <div className="h-44 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.25)' }} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {[1,2,3].map(i => <div key={i} className="h-[360px] rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.25)' }} />)}
        </div>
        <div className="h-[420px] rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.25)' }} />
      </div>
    )
  }

  return (
    <div>

      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between gap-3 mb-5 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.3)' }}>
        <div className="min-w-0">
          <p className="text-[13px] text-slate-400 font-medium mb-0.5">Welcome back, {firstName}</p>
          <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight text-[#1e1b4b] leading-tight truncate">
            {boardingHouseName || 'Dashboard'}
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setShowAnnounceModal(true)}
            className="hidden sm:flex items-center gap-2 h-10 px-4 rounded-full text-[13px] font-semibold transition-all"
            style={{ background: 'rgba(108,92,231,0.1)', color: '#6C5CE7', border: '1px solid rgba(108,92,231,0.2)' }}>
            <Megaphone size={14} /> Announce
          </button>
          <button onClick={() => openQuickLog()}
            className="flex items-center gap-2 h-10 px-5 text-white rounded-full text-[14px] font-semibold"
            style={{ background: '#6C5CE7', boxShadow: '0 4px 14px rgba(108,92,231,0.4)' }}>
            <Plus size={15} /> Log Payment
          </button>
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-1" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[14px] font-bold flex-shrink-0"
              style={{ background: '#6C5CE7', boxShadow: '0 2px 8px rgba(108,92,231,0.3)' }}>
              {profile?.full_name?.[0]?.toUpperCase() ?? 'L'}
            </div>
            <span className="text-[14px] font-semibold text-[#1e1b4b] hidden sm:block">{profile?.full_name}</span>
          </div>
        </div>
      </div>

      {/* ── Landlord Code Banner ── */}
      <div className="mb-5 px-5 py-4 flex items-center justify-between gap-4" style={GLASS}>
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(108,92,231,0.12)', border: '1px solid rgba(108,92,231,0.18)' }}>
            <CreditCard size={16} className="text-[#6C5CE7]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Landlord Code</p>
            <p className="text-[18px] font-bold text-[#1e1b4b] tracking-widest font-mono leading-none">{profile?.landlord_code ?? '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <p className="text-[12px] text-slate-400 hidden sm:block">Share with renters to link their account.</p>
          <button onClick={copyCode}
            className="flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-semibold transition-colors"
            style={copied
              ? { background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#059669' }
              : { background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.2)', color: '#6C5CE7' }}>
            <Copy size={13} /> {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-5">
        <div className="flex items-center gap-2 sm:gap-3 px-3 py-3.5 sm:px-5 sm:py-5" style={GLASS}>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.15)' }}>
            <Users size={15} className="text-[#6C5CE7]" />
          </div>
          <div className="min-w-0">
            <p className="text-[22px] sm:text-[26px] font-bold text-[#1e1b4b] tabular-nums leading-tight">{renterCount}</p>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium uppercase tracking-wide leading-snug">Renters</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 px-3 py-3.5 sm:px-5 sm:py-5" style={GLASS}>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.5)' }}>
            <DoorOpen size={15} className="text-slate-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[22px] sm:text-[26px] font-bold text-[#1e1b4b] tabular-nums leading-tight">{roomCount}</p>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium uppercase tracking-wide leading-snug">Rooms</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 px-3 py-3.5 sm:px-5 sm:py-5"
          style={{ ...GLASS, border: '1px solid rgba(16,185,129,0.2)', boxShadow: '0 4px 16px rgba(16,185,129,0.07)' }}>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <Banknote size={15} className="text-emerald-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[16px] sm:text-[22px] font-bold text-emerald-500 tabular-nums leading-tight">{fmtMoney(collected)}</p>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium uppercase tracking-wide leading-snug">Collected</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 px-3 py-3.5 sm:px-5 sm:py-5" style={GLASS}>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.15)' }}>
            <AlertCircle size={15} className="text-[#6C5CE7]" />
          </div>
          <div className="min-w-0">
            <p className="text-[22px] sm:text-[26px] font-bold text-[#1e1b4b] tabular-nums leading-tight">
              <span className="text-emerald-500">{paidCount}</span>
              <span className="text-slate-300 text-[15px] sm:text-[18px] font-medium">/{totalEligible}</span>
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium uppercase tracking-wide leading-snug">Paid</p>
          </div>
        </div>
      </div>

      {/* ── Date / Month Navigator banner ── */}
      <div className="flex items-center justify-center px-5 py-4 rounded-2xl mb-4 select-none" style={GLASS}>
        <div className="flex items-center gap-5">
          <button onClick={prevMonth}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all text-slate-400 hover:text-[#6C5CE7]"
            style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.7)' }}>
            <ChevronLeft size={16} />
          </button>
          <div className="flex flex-col items-center min-w-[160px]">
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">
              {MONTH_NAMES[calMonth]} {calYear}
            </p>
            {isCurrentMonth ? (
              <p className="text-[42px] font-bold text-[#1e1b4b] tabular-nums leading-none mt-0.5">
                {now.getDate()}
                <span className="text-[16px] font-semibold text-slate-400 ml-2">
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][now.getDay()]}
                </span>
              </p>
            ) : (
              <button onClick={() => { setCalYear(now.getFullYear()); setCalMonth(now.getMonth()) }}
                className="mt-2 h-7 px-4 rounded-full text-[11px] font-semibold transition-all"
                style={{ background: 'rgba(108,92,231,0.1)', color: '#6C5CE7', border: '1px solid rgba(108,92,231,0.18)' }}>
                Back to Today
              </button>
            )}
          </div>
          <button onClick={nextMonth}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all text-slate-400 hover:text-[#6C5CE7]"
            style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.7)' }}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ── 3-column panels grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-5">

        {/* Due Renters This Month */}
        <div className="flex flex-col" style={{ ...GLASS, minHeight: 280, maxHeight: 'min(440px, 55vh)' }}>
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.3)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <AlertCircle size={14} className="text-amber-500" />
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-[#1e1b4b] leading-tight">Due This Month</h3>
                <p className="text-[11px] text-slate-400">{MONTH_NAMES[calMonth]} {calYear}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {unpaid.length > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(245,158,11,0.12)', color: '#d97706' }}>
                  {unpaid.length}
                </span>
              )}
              {unpaid.filter((t: any) => t.user_id).length > 0 && (
                <button
                  onClick={sendAllRentReminders}
                  disabled={remindAllRentLoading || remindAllRentSent}
                  className="h-7 px-3 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-60"
                  style={remindAllRentSent
                    ? { background: 'rgba(16,185,129,0.12)', color: '#059669', border: '1px solid rgba(16,185,129,0.2)' }
                    : { background: 'rgba(108,92,231,0.1)', color: '#6C5CE7', border: '1px solid rgba(108,92,231,0.2)' }}>
                  {remindAllRentLoading ? '…' : remindAllRentSent ? '✓ Sent' : 'Remind All'}
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {unpaid.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                  style={{ background: 'rgba(16,185,129,0.1)' }}>
                  <CheckCircle2 size={18} className="text-emerald-500" />
                </div>
                <p className="text-[14px] font-semibold text-[#1e1b4b]">All paid up!</p>
                <p className="text-[12px] text-slate-400 mt-1">No unpaid renters this month.</p>
              </div>
            ) : (
              <div>
                {unpaid.map((t: any) => (
                  <div key={t.id}
                    className="flex items-center gap-3 px-4 py-3 transition-colors"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.28)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    {t.avatar_url
                      ? <img src={t.avatar_url} alt={t.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      : <div className={`w-8 h-8 rounded-full ${avatarColor(t.name)} flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0`}>{initials(t.name)}</div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#1e1b4b] truncate">{t.name}</p>
                      <p className="text-[11px] text-slate-400">{t.room_number ? `Room ${t.room_number}` : 'No room'}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <p className="text-[12px] font-bold text-[#1e1b4b] tabular-nums">{formatCurrency(t.per_person_rent)}</p>
                      {t.user_id && (
                        <button onClick={() => sendRentReminder(t, 'due')} disabled={reminderLoading === t.id}
                          className="h-6 px-2 rounded-lg text-[10px] font-semibold transition-all disabled:opacity-50"
                          style={reminderSent.has(t.id)
                            ? { background: 'rgba(16,185,129,0.12)', color: '#059669', border: '1px solid rgba(16,185,129,0.2)' }
                            : { background: 'rgba(108,92,231,0.08)', color: '#6C5CE7', border: '1px solid rgba(108,92,231,0.15)' }}>
                          {reminderLoading === t.id ? '…' : reminderSent.has(t.id) ? '✓' : 'Remind'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Electricity Bills */}
        <div className="flex flex-col" style={{ ...GLASS, minHeight: 280, maxHeight: 'min(440px, 55vh)' }}>
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.3)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(255,149,0,0.12)', border: '1px solid rgba(255,149,0,0.2)' }}>
                <Zap size={14} className="text-amber-400" />
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-[#1e1b4b] leading-tight">Electricity Bills</h3>
                <p className="text-[11px] text-slate-400">{MONTH_NAMES[calMonth]} {calYear}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {electricityShares.length > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,149,0,0.1)', color: '#d97706' }}>
                  {electricityShares.length}
                </span>
              )}
              {electricityShares.filter((s: any) => s.user_id).length > 0 && (
                <button
                  onClick={sendAllElecReminders}
                  disabled={remindAllElecLoading || remindAllElecSent}
                  className="h-7 px-3 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-60"
                  style={remindAllElecSent
                    ? { background: 'rgba(16,185,129,0.12)', color: '#059669', border: '1px solid rgba(16,185,129,0.2)' }
                    : { background: 'rgba(255,149,0,0.12)', color: '#d97706', border: '1px solid rgba(255,149,0,0.25)' }}>
                  {remindAllElecLoading ? '…' : remindAllElecSent ? '✓ Sent' : 'Remind All'}
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {electricityShares.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                  style={{ background: 'rgba(255,149,0,0.08)' }}>
                  <Zap size={18} className="text-amber-400" />
                </div>
                <p className="text-[14px] font-semibold text-[#1e1b4b]">No bills posted</p>
                <p className="text-[12px] text-slate-400 mt-1">No electricity bills for this month yet.</p>
              </div>
            ) : (
              <div>
                {electricityShares.map((s: any, i: number) => (
                  <div key={s.tenant_id ?? i}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(255,149,0,0.12)' }}>
                      <Zap size={13} className="text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#1e1b4b] truncate">{s.name}</p>
                      <p className="text-[11px] text-slate-400">{s.room_number ? `Room ${s.room_number}` : 'No room'}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <p className="text-[13px] font-bold text-amber-600 tabular-nums">{formatCurrency(s.amount)}</p>
                      {s.user_id && (
                        <button onClick={() => sendElecReminder(s)} disabled={elecReminderLoading === s.tenant_id}
                          className="h-6 px-2 rounded-lg text-[10px] font-semibold transition-all disabled:opacity-50"
                          style={elecReminderSent.has(s.tenant_id)
                            ? { background: 'rgba(16,185,129,0.12)', color: '#059669', border: '1px solid rgba(16,185,129,0.2)' }
                            : { background: 'rgba(255,149,0,0.1)', color: '#d97706', border: '1px solid rgba(255,149,0,0.2)' }}>
                          {elecReminderLoading === s.tenant_id ? '…' : elecReminderSent.has(s.tenant_id) ? '✓' : 'Remind'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Overdue Renters */}
        <div className="flex flex-col" style={{ ...GLASS, minHeight: 280, maxHeight: 'min(440px, 55vh)' }}>
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.3)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{
                  background: overdue.length > 0 ? 'rgba(255,59,48,0.1)' : 'rgba(255,255,255,0.3)',
                  border: overdue.length > 0 ? '1px solid rgba(255,59,48,0.15)' : '1px solid rgba(255,255,255,0.4)',
                }}>
                <AlertTriangle size={14} className={overdue.length > 0 ? 'text-red-500' : 'text-slate-300'} />
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-[#1e1b4b] leading-tight">Overdue Renters</h3>
                <p className="text-[11px] text-slate-400">Past months unpaid</p>
              </div>
            </div>
            {overdue.length > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(255,59,48,0.1)', color: '#ef4444' }}>
                {overdue.length}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {overdue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                  style={{ background: 'rgba(16,185,129,0.1)' }}>
                  <CheckCircle2 size={18} className="text-emerald-500" />
                </div>
                <p className="text-[14px] font-semibold text-[#1e1b4b]">All caught up!</p>
                <p className="text-[12px] text-slate-400 mt-1">No overdue payments.</p>
              </div>
            ) : (
              <div>
                {overdue.map((t: any) => (
                  <div key={t.id}
                    className="flex items-center gap-3 px-5 py-3.5 transition-colors"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    {t.avatar_url
                      ? <img src={t.avatar_url} alt={t.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      : <div className={`w-8 h-8 rounded-full ${avatarColor(t.name)} flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0`}>{initials(t.name)}</div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#1e1b4b] truncate">{t.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {t.room_number ? `Room ${t.room_number}` : 'No room'} · {t.months_overdue} {t.months_overdue === 1 ? 'month' : 'months'} due
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={t.months_overdue >= 3
                            ? { background: 'rgba(255,59,48,0.1)', color: '#ef4444' }
                            : t.months_overdue === 2
                            ? { background: 'rgba(249,115,22,0.1)', color: '#f97316' }
                            : { background: 'rgba(245,158,11,0.1)', color: '#d97706' }}>
                          {t.months_overdue}mo
                        </span>
                        {t.user_id && (
                          <button onClick={() => sendRentReminder(t, 'overdue')} disabled={reminderLoading === t.id}
                            className="h-6 px-2 rounded-lg text-[10px] font-semibold transition-all disabled:opacity-50"
                            style={reminderSent.has(t.id)
                              ? { background: 'rgba(16,185,129,0.12)', color: '#059669', border: '1px solid rgba(16,185,129,0.2)' }
                              : { background: 'rgba(255,59,48,0.08)', color: '#ef4444', border: '1px solid rgba(255,59,48,0.15)' }}>
                            {reminderLoading === t.id ? '…' : reminderSent.has(t.id) ? '✓' : 'Remind'}
                          </button>
                        )}
                      </div>
                      <p className="text-[12px] font-semibold text-[#1e1b4b] tabular-nums">
                        {formatCurrency(t.months_overdue * t.per_person_rent)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Action Center ── */}
      <div className="mb-5" style={GLASS}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.3)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{
                background: reminderItems.length > 0 ? 'rgba(108,92,231,0.12)' : 'rgba(255,255,255,0.35)',
                border: reminderItems.length > 0 ? '1px solid rgba(108,92,231,0.2)' : '1px solid rgba(255,255,255,0.5)',
              }}>
              <Bell size={15} className={reminderItems.length > 0 ? 'text-[#6C5CE7]' : 'text-slate-300'} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#1e1b4b]">Action Center</h2>
              <p className="text-[11px] text-slate-400">Items requiring your attention</p>
            </div>
          </div>
          {reminderItems.length > 0 && (
            <span className="min-w-[22px] h-[22px] flex items-center justify-center text-[11px] font-bold px-1.5 rounded-full"
              style={{ background: 'rgba(108,92,231,0.12)', color: '#6C5CE7', border: '1px solid rgba(108,92,231,0.18)' }}>
              {reminderItems.length}
            </span>
          )}
        </div>

        {reminderItems.length === 0 ? (
          <div className="py-8 px-6 text-center">
            <p className="text-[14px] text-slate-400">No pending actions</p>
          </div>
        ) : (
          <div className="overflow-y-auto" style={{ maxHeight: 'min(640px, 65vh)' }}>
            {reminderItems.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.id} className="relative px-5 py-4 cursor-pointer transition-all"
                  style={{ background: item.rowBg, borderBottom: '1px solid rgba(255,255,255,0.2)' }}
                  onClick={() => setSelectedReminder(item)}
                  onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.97)')}
                  onMouseLeave={e => (e.currentTarget.style.filter = '')}>
                  {/* Left accent bar */}
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full"
                    style={{ background: item.rowBorder }} />

                  {/* Badge row */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ background: item.iconBg }}>
                        <Icon size={11} className={item.iconColor} />
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: item.badgeBg, color: item.badgeColor }}>
                        {item.badge}
                      </span>
                    </div>
                    {(item.type === 'payment' || item.type === 'maintenance') && (
                      <span className="text-[10px] text-slate-400">{timeAgo(item.data?.created_at)}</span>
                    )}
                  </div>

                  {/* Name + subtitle */}
                  <p className="text-[14px] font-bold text-[#1e1b4b] leading-snug">{item.title}</p>
                  <p className="text-[12px] text-slate-400 mt-0.5 mb-3">{item.subtitle}</p>

                  {/* Bottom row */}
                  <div className="flex items-center gap-3">
                    {item.type === 'overdue-single' && (
                      <p className="text-[13px] font-bold tabular-nums"
                        style={{ color: item.data?.months_overdue >= 3 ? '#ef4444' : '#d97706' }}>
                        {formatCurrency(item.data?.months_overdue * item.data?.per_person_rent)} total
                      </p>
                    )}
                    <span className="h-7 px-3 rounded-lg text-[11px] font-semibold ml-auto flex items-center"
                      style={{ background: 'rgba(108,92,231,0.1)', color: '#6C5CE7', border: '1px solid rgba(108,92,231,0.18)' }}>
                      View details →
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Reminder Detail Modal ── */}
      {selectedReminder && (
        <ReminderDetailModal
          item={selectedReminder}
          onClose={() => setSelectedReminder(null)}
          onApprovePayment={(p) => approvePayment(p)}
          onDeclinePayment={(p, r) => declinePayment(p, r)}
          onProgressMaint={(id) => progressMaintenance(id)}
          onResolveMaint={(id, notes) => resolveMaintenance(id, notes)}
          onApproveVisitor={(v) => approveVisitorDash(v)}
          onRejectVisitor={(v, r) => rejectVisitorDash(v, r)}
          onNavigate={(path) => navigate(path)}
          onRemind={(tenant, type) => sendRentReminder(tenant, type)}
          onOpenLog={(tenantId) => openQuickLog(tenantId)}
          actionLoading={actionLoading}
          visitorActionLoading={visitorActionLoading}
          reminderSent={reminderSent}
          reminderLoading={reminderLoading}
        />
      )}

      {/* ── Log Payment Modal ── */}
      {logDate && (
        <LogPaymentModal
          date={logDate}
          tenants={unpaid.length > 0 ? unpaid : tenants.filter((t: any) => t.room_id)}
          initialTenantId={quickLogTenant}
          onClose={() => { setLogDate(null); setQuickLogTenant(undefined) }}
          onSaved={() => { setLogDate(null); setQuickLogTenant(undefined); init() }}
        />
      )}

      {/* ── Quick Announce Modal ── */}
      {showAnnounceModal && (
        <QuickAnnounceModal
          landlordId={profile!.id}
          onClose={() => setShowAnnounceModal(false)}
          onSaved={() => setShowAnnounceModal(false)}
        />
      )}

    </div>
  )
}
