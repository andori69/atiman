// @ts-nocheck
// NOTE: These extra columns are required:
//   ALTER TABLE electricity_bills ADD COLUMN IF NOT EXISTS receipt_url text;
//   ALTER TABLE electricity_shares ADD COLUMN IF NOT EXISTS is_paid boolean DEFAULT false;
//   ALTER TABLE electricity_shares ADD COLUMN IF NOT EXISTS paid_at timestamptz;

import { useEffect, useState, useRef } from 'react'
import {
  Zap, ChevronLeft, ChevronRight, Upload, X, Lock, CheckCircle2,
  History, Image, AlertCircle, Clock, Search,
  ThumbsUp, ThumbsDown, TrendingDown, Receipt, CreditCard, Calendar,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency } from '@/lib/utils'

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
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.65)',
  borderRadius: 20,
  boxShadow: '0 24px 64px rgba(100,80,200,0.18)',
}
const INPUT_STYLE = { background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.7)' }

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

function mk(y: number, m: number) { return `${y}-${String(m + 1).padStart(2, '0')}` }
function fmtMK(s: string) { const [y, m] = s.split('-'); return `${MONTHS[parseInt(m) - 1]} ${y}` }
function initials(name: string) { return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() }
function avatarColor(name: string) {
  const c = ['bg-violet-400','bg-blue-400','bg-emerald-400','bg-amber-400','bg-rose-400','bg-cyan-400']
  let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % c.length; return c[h]
}
function fmtRef(id: string) { return `ELEC-${id.slice(0, 5).toUpperCase()}` }
function fmtDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

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

/* ── Receipt Lightbox ── */
function ReceiptLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ animation: 'fadeIn 150ms ease-out' }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative max-w-2xl w-full max-h-[90vh] flex flex-col" style={{ ...GLASS_MODAL, borderRadius: 16 }}>
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <p className="text-[15px] font-bold text-[#1e1b4b]">Receipt</p>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400" style={{ background: 'rgba(0,0,0,0.05)' }}>
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
          <img src={url} alt="Receipt" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      </div>
    </div>
  )
}

/* ── Payment Detail Popup ── */
function PaymentDetailModal({ payment, onApprove, onReject, approveLoading, onClose }: {
  payment: any; onApprove: () => void; onReject: () => void; approveLoading: boolean; onClose: () => void
}) {
  const [receiptSrc, setReceiptSrc] = useState<string | null>(null)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [fullReceipt, setFullReceipt] = useState(false)

  useEffect(() => {
    if (payment.receipt_url) {
      setReceiptLoading(true)
      signedReceiptUrl(payment.receipt_url).then(u => { setReceiptSrc(u); setReceiptLoading(false) })
    }
  }, [payment.receipt_url])

  const isPending   = payment.status === 'pending'
  const isApproved  = ['confirmed', 'verified'].includes(payment.status)
  const isRejected  = payment.status === 'rejected'

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col"
          style={{ ...GLASS_MODAL, maxHeight: '88vh' }}>
          {/* Drag bar (mobile) */}
          <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-1 sm:hidden flex-shrink-0" style={{ background: 'rgba(0,0,0,0.12)' }} />

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={isPending
                  ? { background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.2)' }
                  : isApproved
                  ? { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }
                  : { background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.15)' }}>
                <Zap size={15}
                  style={{ color: isPending ? '#d97706' : isApproved ? '#059669' : '#ef4444' }} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {isPending ? 'Pending Review' : isApproved ? 'Approved' : 'Rejected'}
                </p>
                <p className="text-[14px] font-bold text-[#1e1b4b] leading-tight">Electricity Payment</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-slate-400" style={{ background: 'rgba(0,0,0,0.05)' }}>
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Tenant row */}
            <div className="flex items-center gap-3 p-3.5 rounded-2xl"
              style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <div className={`w-11 h-11 rounded-full ${avatarColor(payment.tenant?.name ?? '')} flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0`}>
                {initials(payment.tenant?.name ?? '?')}
              </div>
              <div>
                <p className="text-[15px] font-bold text-[#1e1b4b]">{payment.tenant?.name ?? '—'}</p>
                <p className="text-[12px] text-slate-400">Room {payment.tenant?.room?.room_number ?? '—'}</p>
              </div>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl p-3" style={{ background: 'rgba(108,92,231,0.07)', border: '1px solid rgba(108,92,231,0.12)' }}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-violet-400 mb-1">Amount</p>
                <p className="text-[20px] font-bold text-[#6C5CE7] tabular-nums leading-tight">{formatCurrency(payment.amount)}</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Period</p>
                <p className="text-[13px] font-semibold text-[#1e1b4b]">{fmtMK(payment.month_year)}</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Method</p>
                <div className="flex items-center gap-1.5">
                  <CreditCard size={11} className="text-slate-400" />
                  <p className="text-[13px] font-semibold text-[#1e1b4b] capitalize">{payment.payment_method ?? 'Cash'}</p>
                </div>
              </div>
              <div className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Submitted</p>
                <div className="flex items-center gap-1.5">
                  <Calendar size={11} className="text-slate-400" />
                  <p className="text-[12px] font-semibold text-[#1e1b4b]">{fmtDate(payment.payment_date || payment.created_at)}</p>
                </div>
              </div>
            </div>

            {/* Reference */}
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(108,92,231,0.05)', border: '1px solid rgba(108,92,231,0.1)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400">Ref</p>
              <p className="text-[13px] font-mono font-semibold text-[#1e1b4b]">{fmtRef(payment.id)}</p>
            </div>

            {/* Receipt */}
            {payment.receipt_url && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Receipt</p>
                {receiptLoading ? (
                  <div className="w-full h-40 rounded-2xl animate-pulse" style={{ background: 'rgba(0,0,0,0.06)' }} />
                ) : receiptSrc ? (
                  <div className="relative overflow-hidden rounded-2xl cursor-zoom-in group"
                    onClick={() => setFullReceipt(true)}>
                    <img src={receiptSrc} alt="Receipt"
                      className="w-full object-cover rounded-2xl transition-transform duration-200 group-hover:scale-[1.02]"
                      style={{ maxHeight: 220 }} />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
                      style={{ background: 'rgba(0,0,0,0.25)' }}>
                      <div className="flex items-center gap-2 bg-white/90 rounded-xl px-3 py-1.5">
                        <Image size={13} className="text-[#6C5CE7]" />
                        <span className="text-[12px] font-semibold text-[#1e1b4b]">View full receipt</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-slate-400"
                    style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <Image size={13} />
                    <p className="text-[12px]">Receipt unavailable</p>
                  </div>
                )}
              </div>
            )}

            {/* Rejection reason */}
            {isRejected && payment.rejection_reason && (
              <div className="rounded-xl px-3.5 py-3"
                style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.15)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-1">Rejection Reason</p>
                <p className="text-[12px] text-red-700 italic">"{payment.rejection_reason}"</p>
              </div>
            )}
          </div>

          {/* Footer actions */}
          {isPending && (
            <div className="flex gap-2.5 p-5 flex-shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
              <button onClick={onReject} disabled={approveLoading}
                className="flex-1 h-11 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                style={{ background: 'rgba(255,59,48,0.08)', color: '#ef4444', border: '1px solid rgba(255,59,48,0.15)' }}>
                <ThumbsDown size={14} /> Reject
              </button>
              <button onClick={onApprove} disabled={approveLoading}
                className="flex-1 h-11 rounded-xl text-[14px] font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ background: 'rgba(16,185,129,0.88)', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}>
                <ThumbsUp size={14} /> {approveLoading ? 'Approving…' : 'Approve'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Full receipt lightbox */}
      {fullReceipt && receiptSrc && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          onClick={() => setFullReceipt(false)}>
          <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />
          <div className="relative max-w-2xl w-full max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
            style={GLASS_MODAL} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <p className="text-[14px] font-bold text-[#1e1b4b]">Receipt — {fmtRef(payment.id)}</p>
              <button onClick={() => setFullReceipt(false)} className="p-2 rounded-xl text-slate-400"
                style={{ background: 'rgba(0,0,0,0.05)' }}><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              <img src={receiptSrc} alt="Receipt" className="max-w-full max-h-full rounded-xl object-contain" />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ── Main Page ── */
export default function Electricity() {
  const { profile } = useAuth()
  const now = new Date()

  const [calYear, setCalYear]     = useState(now.getFullYear())
  const [calMonth, setCalMonth]   = useState(now.getMonth())
  const [buildingId, setBuildingId]   = useState<string | null>(null)
  const [buildingName, setBuildingName] = useState('')

  // Current month's bill
  const [existingBill, setExistingBill]     = useState<any>(null)
  const [totalBillInput, setTotalBillInput] = useState('')
  const [billSaving, setBillSaving]         = useState(false)
  const [billError, setBillError]           = useState('')
  const [isEditing, setIsEditing]           = useState(false)

  // Receipt upload
  const [receiptFile, setReceiptFile]           = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview]     = useState<string | null>(null)
  const [receiptUploading, setReceiptUploading] = useState(false)
  const [lightboxUrl, setLightboxUrl]           = useState<string | null>(null)
  const receiptRef = useRef<HTMLInputElement>(null)

  // All electricity payments for current month (all statuses)
  const [monthPayments, setMonthPayments]       = useState<any[]>([])
  const [paymentsLoading, setPaymentsLoading]   = useState(false)

  // Approval actions
  const [approveLoading, setApproveLoading] = useState('')
  const [rejectModal, setRejectModal]       = useState<any>(null)
  const [rejectReason, setRejectReason]     = useState('')
  const [rejectLoading, setRejectLoading]   = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<any>(null)

  // History
  const [history, setHistory]               = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [expandedId, setExpandedId]         = useState<string | null>(null)
  const [expandedBillData, setExpandedBillData] = useState<Record<string, any[]>>({})
  const [historySearch, setHistorySearch]   = useState('')

  // ── Load building once ───────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('buildings').select('id, name').eq('landlord_id', profile!.id).limit(1).maybeSingle()
      .then(({ data }) => { if (data) { setBuildingId(data.id); setBuildingName(data.name) } })
  }, [])

  // ── Fetch when month or building changes ─────────────────────────────────────
  useEffect(() => {
    if (!buildingId) return
    fetchBillForMonth()
    fetchMonthPayments()
    fetchHistory()
  }, [buildingId, calYear, calMonth])

  // ── Realtime ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!buildingId) return
    const ch = supabase.channel('electricity-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'electricity_bills' },
        () => { fetchBillForMonth(); fetchHistory() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' },
        () => fetchMonthPayments())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [buildingId])

  // ── Fetchers ─────────────────────────────────────────────────────────────────
  async function fetchBillForMonth() {
    if (!buildingId) return
    setBillError('')
    const curMK = mk(calYear, calMonth)
    const { data: billData } = await supabase.from('electricity_bills')
      .select('*').eq('building_id', buildingId).eq('month_year', curMK).maybeSingle()
    if (!billData) {
      setExistingBill(null); setTotalBillInput(''); setIsEditing(false); setReceiptPreview(null); return
    }
    setExistingBill(billData)
    setReceiptPreview(billData.receipt_url ?? null)
  }

  async function getRoomIds() {
    const { data } = await supabase.from('rooms').select('id').eq('building_id', buildingId)
    return (data ?? []).map((r: any) => r.id)
  }

  async function fetchMonthPayments() {
    if (!buildingId) return
    setPaymentsLoading(true)
    const curMK = mk(calYear, calMonth)
    const roomIds = await getRoomIds()
    if (!roomIds.length) { setMonthPayments([]); setPaymentsLoading(false); return }

    const { data } = await supabase.from('payments')
      .select('id, amount, month_year, payment_date, payment_method, receipt_url, notes, created_at, status, rejection_reason, tenant_id, tenant:tenants(id, name, user_id, room:rooms(room_number))')
      .in('room_id', roomIds)
      .eq('month_year', curMK)
      .ilike('notes', 'Electricity%')
      .order('created_at', { ascending: false })
    setMonthPayments(data ?? [])
    setPaymentsLoading(false)
  }

  async function fetchHistory() {
    if (!buildingId) return
    setHistoryLoading(true)
    setExpandedBillData({})
    const { data } = await supabase.from('electricity_bills')
      .select('id, total_amount, month_year, receipt_url, created_at')
      .eq('building_id', buildingId)
      .order('month_year', { ascending: false }).limit(12)
    setHistory(data ?? [])
    setHistoryLoading(false)
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const pendingPayments   = monthPayments.filter(p => p.status === 'pending')
  const confirmedPayments = monthPayments.filter(p => ['confirmed', 'verified'].includes(p.status))
  const rejectedPayments  = monthPayments.filter(p => p.status === 'rejected')
  const collected  = confirmedPayments.reduce((s, p) => s + Number(p.amount), 0)
  const remaining  = (existingBill?.total_amount ?? 0) - collected
  const collectPct = existingBill?.total_amount > 0 ? Math.min(100, (collected / existingBill.total_amount) * 100) : 0

  // ── Approve ──────────────────────────────────────────────────────────────────
  async function approvePayment(payment: any) {
    setApproveLoading(payment.id)
    const ref = fmtRef(payment.id)
    await supabase.from('payments')
      .update({ status: 'confirmed', verified_by: profile!.id, reference_number: ref })
      .eq('id', payment.id)
    const { data: bill } = await supabase.from('electricity_bills')
      .select('id').eq('building_id', buildingId).eq('month_year', payment.month_year).maybeSingle()
    if (bill) {
      await supabase.from('electricity_shares')
        .update({ is_paid: true, paid_at: new Date().toISOString() })
        .eq('bill_id', bill.id).eq('tenant_id', payment.tenant_id)
      setExpandedBillData(prev => { const n = { ...prev }; delete n[bill.id]; return n })
    }
    if (payment.tenant?.user_id) {
      await supabase.from('notifications').insert({
        user_id: payment.tenant.user_id,
        title: 'Electricity Payment Confirmed',
        message: `Your electricity payment of ${formatCurrency(payment.amount)} for ${fmtMK(payment.month_year)} has been confirmed by your landlord. Reference: ${ref}`,
        notification_type: 'electricity_paid', is_read: false,
      })
    }
    setApproveLoading('')
    fetchMonthPayments()
  }

  // ── Reject ───────────────────────────────────────────────────────────────────
  async function confirmReject() {
    if (!rejectModal) return
    setRejectLoading(true)
    await supabase.from('payments')
      .update({ status: 'rejected', rejection_reason: rejectReason || null })
      .eq('id', rejectModal.id)
    if (rejectModal.tenant?.user_id) {
      await supabase.from('notifications').insert({
        user_id: rejectModal.tenant.user_id,
        title: 'Electricity Payment Rejected',
        message: `Your electricity payment of ${formatCurrency(rejectModal.amount)} for ${fmtMK(rejectModal.month_year)} was not approved.${rejectReason ? ' Reason: ' + rejectReason : ''} Please resubmit with a valid receipt.`,
        notification_type: 'payment_rejected', is_read: false,
      })
    }
    setRejectLoading(false); setRejectModal(null); setRejectReason('')
    setExpandedBillData({})
    fetchMonthPayments()
  }

  // ── Save bill ────────────────────────────────────────────────────────────────
  async function saveBill() {
    if (!buildingId || !totalBillInput || parseFloat(totalBillInput) <= 0) return
    setBillSaving(true); setBillError('')
    const total = parseFloat(totalBillInput)
    const curMK = mk(calYear, calMonth)

    const { data: rooms } = await supabase.from('rooms')
      .select('id, tenants!inner(id, name, user_id, occupants, is_active)')
      .eq('building_id', buildingId)
    const activeTenants: any[] = []
    for (const r of rooms ?? []) {
      for (const t of (r as any).tenants ?? []) {
        if (t.is_active) activeTenants.push({ ...t, room_id: r.id })
      }
    }
    if (activeTenants.length === 0) {
      setBillError('No active tenants found in this building.'); setBillSaving(false); return
    }

    const totalOccupants = activeTenants.reduce((s: number, t: any) => s + (t.occupants ?? 1), 0) || activeTenants.length
    let runningTotal = 0
    const shareAmounts = activeTenants.map((t: any, i: number) => {
      if (i === activeTenants.length - 1) return Math.round((total - runningTotal) * 100) / 100
      const share = Math.round(((t.occupants ?? 1) / totalOccupants) * total * 100) / 100
      runningTotal += share; return share
    })

    let receiptUrl: string | null = existingBill?.receipt_url ?? null
    if (receiptFile) {
      setReceiptUploading(true)
      const ext = receiptFile.name.split('.').pop()
      const path = `electricity/${buildingId}-${curMK}.${ext}`
      const { error: upErr } = await supabase.storage.from('expense-receipts').upload(path, receiptFile, { upsert: true })
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('expense-receipts').getPublicUrl(path)
        receiptUrl = publicUrl
      }
      setReceiptUploading(false)
    }

    if (existingBill && isEditing) {
      await supabase.from('electricity_bills')
        .update({ total_amount: total, ...(receiptUrl ? { receipt_url: receiptUrl } : {}) })
        .eq('id', existingBill.id)
      const { data: existingShares } = await supabase.from('electricity_shares')
        .select('id, tenant_id').eq('bill_id', existingBill.id)
      for (const [i, t] of activeTenants.entries()) {
        const shareId = (existingShares ?? []).find((s: any) => s.tenant_id === t.id)?.id
        if (shareId) {
          await supabase.from('electricity_shares').update({ share_amount: shareAmounts[i], occupants: t.occupants ?? 1 }).eq('id', shareId)
        } else {
          await supabase.from('electricity_shares').insert({ bill_id: existingBill.id, tenant_id: t.id, share_amount: shareAmounts[i], occupants: t.occupants ?? 1, is_adjusted: false })
        }
      }
      setIsEditing(false)
    } else {
      const billPayload: any = { building_id: buildingId, total_amount: total, month_year: curMK }
      if (receiptUrl) billPayload.receipt_url = receiptUrl
      const { data: bill, error: billErr } = await supabase.from('electricity_bills').insert(billPayload).select('id').single()
      if (billErr || !bill) { setBillError(billErr?.message ?? 'Failed to save bill.'); setBillSaving(false); return }
      const shareRows = activeTenants.map((t: any, i: number) => ({
        bill_id: bill.id, tenant_id: t.id, share_amount: shareAmounts[i], occupants: t.occupants ?? 1, is_adjusted: false,
      }))
      await supabase.from('electricity_shares').insert(shareRows)
      for (const t of activeTenants) {
        if (t.user_id) {
          const share = shareRows.find(s => s.tenant_id === t.id)
          await supabase.from('notifications').insert({
            user_id: t.user_id,
            title: 'Electricity Bill Posted',
            message: `Your electricity share for ${fmtMK(curMK)} is ${formatCurrency(share?.share_amount ?? 0)}.`,
            notification_type: 'electricity', is_read: false,
          })
        }
      }
    }
    setBillSaving(false); setReceiptFile(null)
    fetchBillForMonth(); fetchHistory(); fetchMonthPayments()
  }

  // ── History expand ───────────────────────────────────────────────────────────
  async function toggleHistoryExpand(bill: any) {
    if (expandedId === bill.id) { setExpandedId(null); return }
    setExpandedId(bill.id)
    if (expandedBillData[bill.id]) return
    const roomIds = await getRoomIds()

    const [{ data: shares }, { data: payments }, { data: pendingPays }] = await Promise.all([
      supabase.from('electricity_shares')
        .select('id, tenant_id, share_amount, is_paid, paid_at, tenant:tenants(name, room:rooms(room_number))')
        .eq('bill_id', bill.id),
      supabase.from('payments')
        .select('id, tenant_id, amount, receipt_url, created_at')
        .in('room_id', roomIds)
        .eq('month_year', bill.month_year)
        .in('status', ['confirmed', 'verified'])
        .ilike('notes', 'Electricity%'),
      supabase.from('payments')
        .select('id, tenant_id, amount, created_at')
        .in('room_id', roomIds)
        .eq('month_year', bill.month_year)
        .eq('status', 'pending')
        .ilike('notes', 'Electricity%'),
    ])

    const payByTenant     = new Map((payments    ?? []).map((p: any) => [p.tenant_id, p]))
    const pendingByTenant = new Map((pendingPays ?? []).map((p: any) => [p.tenant_id, p]))
    const rows = (shares ?? []).map((s: any) => {
      const pay     = payByTenant.get(s.tenant_id)
      const pending = pendingByTenant.get(s.tenant_id)
      const isPaid  = !!(s.is_paid || pay)
      return {
        tenantName: s.tenant?.name ?? '—',
        roomNumber: s.tenant?.room?.room_number ?? '—',
        shareAmount: s.share_amount,
        isPaid,
        isPending: !isPaid && !!pending,
        paymentId: pay?.id ?? null,
        receiptUrl: pay?.receipt_url ?? null,
        paidAt: pay?.created_at ?? s.paid_at ?? null,
      }
    }).sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }))

    setExpandedBillData(prev => ({ ...prev, [bill.id]: rows }))
  }

  function prevMonth() { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) } else setCalMonth(m => m - 1) }
  function nextMonth() { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) } else setCalMonth(m => m + 1) }

  const curMK = mk(calYear, calMonth)
  const nowMK = mk(now.getFullYear(), now.getMonth())
  const isCurrentMonth = curMK === nowMK
  const isFuture = curMK > nowMK

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1e1b4b]">Electricity</h1>
        <p className="text-[15px] text-slate-400 mt-0.5">{buildingName || 'Manage'} · monthly bill distribution</p>
      </div>

      {/* ── Month Navigation ── */}
      <div style={GLASS} className="px-8 py-6">
        <div className="flex items-center justify-between gap-6 max-w-sm mx-auto">
          <button onClick={prevMonth}
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-slate-400 hover:text-[#6C5CE7] transition-all"
            style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.6)' }}>
            <ChevronLeft size={20} />
          </button>
          <div className="text-center select-none">
            <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-0.5">{MONTHS[calMonth]}</p>
            <p className="text-[48px] font-bold text-[#1e1b4b] tabular-nums leading-none">{calYear}</p>
            {isCurrentMonth && (
              <span className="mt-2 inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                style={{ background: 'rgba(108,92,231,0.1)', color: '#6C5CE7' }}>Current Month</span>
            )}
          </div>
          <button onClick={nextMonth} disabled={isFuture}
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-slate-400 hover:text-[#6C5CE7] transition-all disabled:opacity-30"
            style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.6)' }}>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* ── Bill Card ── */}
      <div style={GLASS} className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,149,0,0.12)', border: '1px solid rgba(255,149,0,0.2)' }}>
            <Zap size={18} className="text-amber-500" />
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-[#1e1b4b]">Total Electricity Bill</h2>
            <p className="text-[12px] text-slate-400">{MONTHS[calMonth]} {calYear}</p>
          </div>
          {existingBill && !isCurrentMonth && (
            <div className="ml-auto flex items-center gap-1.5 text-slate-400">
              <Lock size={13} /><span className="text-[11px] font-medium">Locked</span>
            </div>
          )}
        </div>

        {existingBill && isEditing && isCurrentMonth ? (
          <div className="space-y-4">
            <div className="px-4 py-3 rounded-xl flex items-center gap-2"
              style={{ background: 'rgba(255,149,0,0.07)', border: '1px solid rgba(255,149,0,0.18)' }}>
              <Zap size={13} className="text-amber-500 flex-shrink-0" />
              <p className="text-[12px] text-amber-700 font-medium">Editing {MONTHS[calMonth]} {calYear} bill. Shares will be recalculated.</p>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Updated Total Bill (₱)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[17px] font-medium">₱</span>
                <input type="number" value={totalBillInput} onChange={e => setTotalBillInput(e.target.value)}
                  placeholder="0.00" min="0" step="0.01"
                  className="w-full h-14 rounded-xl pl-9 pr-4 text-[22px] font-bold text-[#1e1b4b] outline-none tabular-nums"
                  style={INPUT_STYLE} />
              </div>
            </div>
            {billError && <div className="px-4 py-3 rounded-xl text-[13px] text-red-600" style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.15)' }}>{billError}</div>}
            <div className="flex gap-2">
              <button onClick={() => setIsEditing(false)} className="flex-1 h-11 rounded-xl text-[14px] font-semibold text-slate-500" style={{ background: 'rgba(0,0,0,0.05)' }}>Cancel</button>
              <button onClick={saveBill} disabled={billSaving || !totalBillInput || parseFloat(totalBillInput) <= 0}
                className="flex-1 flex items-center justify-center gap-2 h-11 text-white rounded-xl font-semibold text-[14px] disabled:opacity-40"
                style={{ background: 'rgba(108,92,231,0.88)', boxShadow: '0 4px 14px rgba(108,92,231,0.35)' }}>
                <Zap size={14} />{billSaving ? 'Updating…' : 'Update Bill'}
              </button>
            </div>
          </div>
        ) : existingBill ? (
          <div className="space-y-4">
            <div className="rounded-2xl p-5 flex items-center justify-between"
              style={{ background: 'rgba(255,149,0,0.07)', border: '1px solid rgba(255,149,0,0.15)' }}>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400 mb-1">Total Bill</p>
                <p className="text-[40px] font-bold text-[#1e1b4b] tabular-nums leading-none">{formatCurrency(existingBill.total_amount)}</p>
                <p className="text-[12px] text-slate-400 mt-1">proportional split by occupants</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {receiptPreview ? (
                  <button onClick={() => setLightboxUrl(receiptPreview)}
                    className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-[12px] font-semibold transition-all"
                    style={{ background: 'rgba(108,92,231,0.1)', color: '#6C5CE7', border: '1px solid rgba(108,92,231,0.18)' }}>
                    <Image size={13} /> View Receipt
                  </button>
                ) : isCurrentMonth ? (
                  <button onClick={() => receiptRef.current?.click()}
                    className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-[12px] font-semibold transition-all"
                    style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.7)', color: '#64748b' }}>
                    <Upload size={13} /> Upload Receipt
                  </button>
                ) : null}
                {isCurrentMonth && (
                  <button onClick={() => { setTotalBillInput(existingBill.total_amount.toString()); setIsEditing(true) }}
                    className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-[12px] font-semibold transition-all"
                    style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.7)', color: '#64748b' }}>
                    Edit Bill
                  </button>
                )}
              </div>
            </div>
            {!isCurrentMonth && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)' }}>
                <Lock size={12} className="text-slate-300 flex-shrink-0" />
                <p className="text-[12px] text-slate-400">Past month bills are locked and cannot be edited.</p>
              </div>
            )}
          </div>
        ) : isFuture ? (
          <div className="rounded-2xl p-5 text-center" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
            <p className="text-[14px] text-slate-400">No bill for a future month.</p>
          </div>
        ) : !isCurrentMonth ? (
          <div className="rounded-2xl p-5 flex items-center gap-3" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
            <Lock size={16} className="text-slate-300 flex-shrink-0" />
            <p className="text-[14px] text-slate-400">No bill recorded for this month.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Total Bill Amount (₱)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[17px] font-medium">₱</span>
                <input type="number" value={totalBillInput} onChange={e => setTotalBillInput(e.target.value)}
                  placeholder="0.00" min="0" step="0.01"
                  className="w-full h-14 rounded-xl pl-9 pr-4 text-[22px] font-bold text-[#1e1b4b] outline-none tabular-nums"
                  style={INPUT_STYLE} />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Receipt (optional)</label>
              {receiptPreview ? (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.7)' }}>
                  <img src={receiptPreview} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#1e1b4b] truncate">{receiptFile?.name}</p>
                    <button onClick={() => setLightboxUrl(receiptPreview)} className="text-[12px] font-medium" style={{ color: '#6C5CE7' }}>Preview</button>
                  </div>
                  <button onClick={() => { setReceiptFile(null); setReceiptPreview(null) }} className="p-1.5 rounded-lg text-slate-400" style={{ background: 'rgba(0,0,0,0.05)' }}><X size={14} /></button>
                </div>
              ) : (
                <button onClick={() => receiptRef.current?.click()}
                  className="flex items-center gap-2 h-11 px-4 rounded-xl text-[14px] font-medium transition-all"
                  style={{ background: 'rgba(255,255,255,0.5)', border: '1px dashed rgba(108,92,231,0.3)', color: '#6C5CE7' }}>
                  <Upload size={15} /> Upload Receipt Photo
                </button>
              )}
              <input ref={receiptRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (!f) return; setReceiptFile(f); setReceiptPreview(URL.createObjectURL(f)) }} />
            </div>
            {billError && <div className="px-4 py-3 rounded-xl text-[13px] text-red-600" style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.15)' }}>{billError}</div>}
            <button onClick={saveBill} disabled={billSaving || !totalBillInput || parseFloat(totalBillInput) <= 0}
              className="flex items-center gap-2 h-11 px-6 text-white rounded-xl font-semibold text-[14px] disabled:opacity-40 transition-all"
              style={{ background: 'rgba(108,92,231,0.88)', boxShadow: '0 4px 14px rgba(108,92,231,0.35)' }}>
              <Zap size={15} />{billSaving || receiptUploading ? 'Saving…' : 'Save & Distribute Bill'}
            </button>
          </div>
        )}
      </div>

      {/* ── Payment Submissions + Summary (only when bill exists) ── */}
      {existingBill && (
        paymentsLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2].map(i => <div key={i} className="h-64 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.25)' }} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Left — Payment Submissions */}
            <div className="flex flex-col" style={{ ...GLASS, minHeight: 320 }}>
              <div className="flex-shrink-0 flex items-center justify-between px-5 py-4"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.3)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(255,149,0,0.12)', border: '1px solid rgba(255,149,0,0.2)' }}>
                    <Clock size={13} className="text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-[#1e1b4b] leading-tight">Pending Approvals</h3>
                    <p className="text-[11px] text-slate-400">{MONTHS[calMonth]} {calYear}</p>
                  </div>
                </div>
                {pendingPayments.length > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,149,0,0.12)', color: '#b45309' }}>
                    {pendingPayments.length}
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto">
                {pendingPayments.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4 py-10">
                    <CheckCircle2 size={24} className="text-emerald-300 mb-2" />
                    <p className="text-[13px] text-slate-400">No pending approvals.</p>
                    <p className="text-[11px] text-slate-300 mt-1">All electricity payments have been reviewed.</p>
                  </div>
                ) : (
                  <div>
                    {pendingPayments.map((p: any) => (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}
                        onClick={() => setSelectedPayment(p)}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,149,0,0.06)')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <div className={`w-8 h-8 rounded-full ${avatarColor(p.tenant?.name ?? '')} flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0`}>
                          {initials(p.tenant?.name ?? '?')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-[#1e1b4b] truncate">{p.tenant?.name ?? '—'}</p>
                          <p className="text-[10px] text-slate-400">Room {p.tenant?.room?.room_number ?? '—'} · {fmtDate(p.payment_date || p.created_at)}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[14px] font-bold text-[#1e1b4b] tabular-nums">{formatCurrency(p.amount)}</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(255,149,0,0.12)', color: '#b45309' }}>Pending</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right — Summary */}
            <div className="flex flex-col gap-3">
              <div style={{ ...GLASS, borderRadius: 16 }} className="p-5 space-y-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Collection Summary</p>

                <div className="flex items-center justify-between py-3 rounded-xl px-4"
                  style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.18)' }}>
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-amber-500" />
                    <p className="text-[13px] font-semibold text-slate-600">Total Bill</p>
                  </div>
                  <p className="text-[17px] font-bold text-[#1e1b4b] tabular-nums">{formatCurrency(existingBill.total_amount)}</p>
                </div>

                <div className="flex items-center justify-between py-3 rounded-xl px-4"
                  style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)' }}>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    <p className="text-[13px] font-semibold text-slate-600">Collected</p>
                  </div>
                  <p className="text-[17px] font-bold text-emerald-600 tabular-nums">{formatCurrency(collected)}</p>
                </div>

                <div className="flex items-center justify-between py-3 rounded-xl px-4"
                  style={{ background: remaining > 0 ? 'rgba(255,59,48,0.07)' : 'rgba(16,185,129,0.07)', border: remaining > 0 ? '1px solid rgba(255,59,48,0.18)' : '1px solid rgba(16,185,129,0.18)' }}>
                  <div className="flex items-center gap-2">
                    <TrendingDown size={14} style={{ color: remaining > 0 ? '#ef4444' : '#059669' }} />
                    <p className="text-[13px] font-semibold text-slate-600">Remaining</p>
                  </div>
                  <p className="text-[17px] font-bold tabular-nums" style={{ color: remaining > 0 ? '#ef4444' : '#059669' }}>{formatCurrency(remaining)}</p>
                </div>

                <div className="space-y-1.5">
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${collectPct}%`, background: remaining <= 0 ? '#10b981' : 'linear-gradient(90deg, #6C5CE7, #10b981)' }} />
                  </div>
                  <p className="text-[11px] text-slate-400 text-right">{Math.round(collectPct)}% collected</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Submissions', value: monthPayments.length, icon: Receipt,       color: '#6C5CE7', bg: 'rgba(108,92,231,0.08)', border: 'rgba(108,92,231,0.15)' },
                  { label: 'Approved',    value: confirmedPayments.length, icon: CheckCircle2, color: '#059669', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.15)'  },
                  { label: 'Pending',     value: pendingPayments.length,   icon: Clock,       color: '#b45309', bg: 'rgba(255,149,0,0.07)',    border: 'rgba(255,149,0,0.2)'    },
                  { label: 'Rejected',    value: rejectedPayments.length,  icon: AlertCircle, color: '#ef4444', bg: 'rgba(255,59,48,0.07)',    border: 'rgba(255,59,48,0.15)'   },
                ].map(({ label, value, icon: Icon, color, bg, border }) => (
                  <div key={label} className="p-4" style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14 }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={13} style={{ color }} />
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                    </div>
                    <p className="text-[24px] font-bold tabular-nums leading-tight" style={{ color: '#1e1b4b' }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )
      )}

      {/* ── Bill History ── */}
      <div style={GLASS} className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.3)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.15)' }}>
              <History size={13} className="text-[#6C5CE7]" />
            </div>
            <h2 className="text-[14px] font-bold text-[#1e1b4b]">Bill History</h2>
          </div>
          <div className="relative flex-shrink-0">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              placeholder="Search tenant or room…"
              className="h-8 pl-8 pr-3 rounded-xl text-[12px] outline-none w-44"
              style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.7)' }}
            />
          </div>
        </div>

        {historyLoading ? (
          <div className="p-5 space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.4)' }} />)}</div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center">
            <Zap size={24} className="text-slate-300 mx-auto mb-2" />
            <p className="text-[14px] text-slate-400">No bills recorded yet.</p>
          </div>
        ) : (
          <div>
            {history.map((bill: any) => {
              const isExpanded  = expandedId === bill.id
              const hRows       = expandedBillData[bill.id]
              const isThisMonth = bill.month_year === curMK
              return (
                <div key={bill.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                  <button onClick={() => toggleHistoryExpand(bill)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left transition-all"
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.15)' }}>
                        <Zap size={14} className="text-amber-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[14px] font-semibold text-[#1e1b4b]">{fmtMK(bill.month_year)}</p>
                          {isThisMonth && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(108,92,231,0.1)', color: '#6C5CE7' }}>NOW</span>}
                        </div>
                        <p className="text-[12px] text-slate-400 tabular-nums">{formatCurrency(bill.total_amount)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {isExpanded && hRows && hRows.length > 0 && (() => {
                        const paidCt    = hRows.filter((r: any) => r.isPaid).length
                        const pendingCt = hRows.filter((r: any) => r.isPending).length
                        return (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(16,185,129,0.1)', color: '#059669' }}>
                              {paidCt}/{hRows.length} paid
                            </span>
                            {pendingCt > 0 && (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(255,149,0,0.1)', color: '#b45309' }}>
                                {pendingCt} pending
                              </span>
                            )}
                          </div>
                        )
                      })()}
                      {bill.receipt_url && (
                        <button onClick={e => { e.stopPropagation(); setLightboxUrl(bill.receipt_url) }}
                          className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium transition-all"
                          style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.7)', color: '#64748b' }}>
                          <Image size={11} /> Receipt
                        </button>
                      )}
                      <ChevronLeft size={15} className="text-slate-400 transition-transform duration-200"
                        style={{ transform: isExpanded ? 'rotate(-90deg)' : 'rotate(180deg)' }} />
                    </div>
                  </button>

                  {isExpanded && (() => {
                    if (!hRows) return (
                      <div className="px-5 pb-5 pt-4 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.25)' }}>
                        <div className="flex gap-2 flex-col items-center">
                          <div className="h-10 w-full rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.4)' }} />
                          <div className="h-10 w-full rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.4)' }} />
                        </div>
                      </div>
                    )
                    const q = historySearch.trim().toLowerCase()
                    const filtered = q
                      ? hRows.filter((r: any) => r.tenantName.toLowerCase().includes(q) || r.roomNumber.toLowerCase().includes(q))
                      : hRows
                    return (
                      <div className="px-5 pb-5" style={{ borderTop: '1px solid rgba(255,255,255,0.25)' }}>
                        {hRows.length === 0 ? (
                          <div className="pt-5 text-center">
                            <Receipt size={20} className="text-slate-300 mx-auto mb-2" />
                            <p className="text-[13px] text-slate-400">No tenant shares for this bill.</p>
                          </div>
                        ) : filtered.length === 0 ? (
                          <div className="pt-5 text-center">
                            <Search size={18} className="text-slate-300 mx-auto mb-2" />
                            <p className="text-[13px] text-slate-400">No tenants match "{historySearch}".</p>
                          </div>
                        ) : (
                          <div className="pt-3 space-y-2">
                            {filtered.map((row: any, idx: number) => (
                              <div key={idx}
                                onClick={() => row.isPaid && row.receiptUrl && signedReceiptUrl(row.receiptUrl).then(u => setLightboxUrl(u))}
                                className="flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all"
                                style={{
                                  background: row.isPaid ? 'rgba(16,185,129,0.06)' : row.isPending ? 'rgba(255,149,0,0.05)' : 'rgba(255,59,48,0.04)',
                                  border: row.isPaid ? '1px solid rgba(16,185,129,0.15)' : row.isPending ? '1px solid rgba(255,149,0,0.2)' : '1px solid rgba(255,59,48,0.12)',
                                  cursor: row.isPaid && row.receiptUrl ? 'pointer' : 'default',
                                }}
                                onMouseEnter={e => { if (row.isPaid && row.receiptUrl) e.currentTarget.style.background = 'rgba(16,185,129,0.12)' }}
                                onMouseLeave={e => (e.currentTarget.style.background = row.isPaid ? 'rgba(16,185,129,0.06)' : row.isPending ? 'rgba(255,149,0,0.05)' : 'rgba(255,59,48,0.04)')}>
                                <div className={`w-9 h-9 rounded-full ${avatarColor(row.tenantName)} flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0`}>
                                  {initials(row.tenantName)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-semibold text-[#1e1b4b] truncate">{row.tenantName}</p>
                                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                    <p className="text-[10px] text-slate-400">Room {row.roomNumber}</p>
                                    {row.isPaid && row.paymentId && (
                                      <>
                                        <span className="text-slate-300 text-[9px]">·</span>
                                        <p className="text-[10px] font-mono text-slate-500 font-medium">{fmtRef(row.paymentId)}</p>
                                      </>
                                    )}
                                  </div>
                                  {row.isPaid && row.paidAt && (
                                    <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(row.paidAt)}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {row.isPaid && row.receiptUrl && (
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                      style={{ background: 'rgba(108,92,231,0.12)', border: '1px solid rgba(108,92,231,0.2)' }}>
                                      <Image size={12} className="text-[#6C5CE7]" />
                                    </div>
                                  )}
                                  <div className="text-right">
                                    <p className={`text-[15px] font-bold tabular-nums ${row.isPaid ? 'text-emerald-600' : row.isPending ? 'text-amber-600' : 'text-red-500'}`}>
                                      {formatCurrency(row.shareAmount)}
                                    </p>
                                    {row.isPaid
                                      ? <CheckCircle2 size={11} className="text-emerald-400 ml-auto mt-0.5" />
                                      : row.isPending
                                        ? <span className="text-[9px] font-bold text-amber-500 block text-right mt-0.5">Pending</span>
                                        : <span className="text-[9px] font-bold text-red-400 block text-right mt-0.5">Unpaid</span>
                                    }
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Payment Detail Popup ── */}
      {selectedPayment && (
        <PaymentDetailModal
          payment={selectedPayment}
          approveLoading={approveLoading === selectedPayment.id}
          onApprove={() => { approvePayment(selectedPayment); setSelectedPayment(null) }}
          onReject={() => { setRejectModal(selectedPayment); setRejectReason(''); setSelectedPayment(null) }}
          onClose={() => setSelectedPayment(null)}
        />
      )}

      {/* ── Reject Modal ── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setRejectModal(null)} />
          <div className="relative w-full max-w-sm p-6" style={GLASS_MODAL}>
            <h3 className="text-[17px] font-bold text-[#1e1b4b] mb-1">Reject Payment</h3>
            <p className="text-[13px] text-slate-400 mb-0.5">
              {rejectModal.tenant?.name} · Room {rejectModal.tenant?.room?.room_number} · {fmtMK(rejectModal.month_year)}
            </p>
            <p className="text-[10px] font-mono text-slate-300 mb-4">{fmtRef(rejectModal.id)}</p>
            <p className="text-[13px] text-slate-400 mb-3">Optionally explain why this payment was rejected.</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason (optional)" rows={3}
              className="w-full rounded-xl px-4 py-3 text-[14px] text-[#1e1b4b] outline-none resize-none mb-4"
              style={INPUT_STYLE} />
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)}
                className="flex-1 h-11 rounded-xl font-medium text-[14px] text-slate-500"
                style={{ background: 'rgba(0,0,0,0.05)' }}>Cancel</button>
              <button onClick={confirmReject} disabled={rejectLoading}
                className="flex-1 h-11 text-white rounded-xl font-semibold text-[14px] disabled:opacity-50"
                style={{ background: 'rgba(239,68,68,0.88)', boxShadow: '0 4px 12px rgba(239,68,68,0.25)' }}>
                {rejectLoading ? 'Rejecting…' : 'Reject Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {lightboxUrl && <ReceiptLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  )
}
