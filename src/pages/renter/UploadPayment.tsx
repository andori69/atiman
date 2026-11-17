// @ts-nocheck
import { useEffect, useState, useRef } from 'react'
import { CheckCircle2, Clock, AlertCircle, AlertTriangle, ChevronDown, Check, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency } from '@/lib/utils'

const SOLO_DISCOUNT = 500
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

function monthKey(y: number, m: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}`
}
function formatMonthYear(mk: string) {
  const [y, m] = mk.split('-')
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`
}
function calcPerPerson(rent: number, count: number) {
  return count <= 1 ? rent - SOLO_DISCOUNT : rent / count
}

const STATUS_PRIORITY: Record<string, number> = { confirmed: 4, verified: 3, pending: 2, rejected: 1 }

export default function UploadPayment() {
  const { profile } = useAuth()
  const now = new Date()
  const currentMK = monthKey(now.getFullYear(), now.getMonth())

  // Build month options once (current + past 11)
  const monthOptions: { value: string; label: string }[] = []
  for (let i = 0; i <= 11; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const mk = monthKey(d.getFullYear(), d.getMonth())
    monthOptions.push({ value: mk, label: formatMonthYear(mk) })
  }

  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [existingPayment, setExistingPayment] = useState<any>(null)
  const [checkingExisting, setCheckingExisting] = useState(false)
  const [paymentMap, setPaymentMap] = useState<Record<string, string>>({})
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [monthYear, setMonthYear] = useState(currentMK)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [notes, setNotes] = useState('')

  useEffect(() => { init() }, [])

  useEffect(() => {
    if (tenant?.id) checkExisting()
  }, [monthYear, tenant?.id])

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [])

  async function init() {
    setLoading(true)
    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('id, name, room_id, room:rooms(room_number, rent_amount, tenants(id, is_active))')
      .eq('user_id', profile!.id)
      .eq('is_active', true)
      .maybeSingle()

    if (tenantRow) {
      const occ = (tenantRow.room?.tenants ?? []).filter((t: any) => t.is_active).length
      const perPerson = calcPerPerson(tenantRow.room?.rent_amount ?? 0, occ)
      setTenant({ ...tenantRow, per_person_rent: perPerson })
      setAmount(perPerson.toFixed(2))

      // Fetch statuses for all 12 months at once
      const { data: paymentsData } = await supabase
        .from('payments')
        .select('month_year, status')
        .eq('tenant_id', tenantRow.id)
        .in('month_year', monthOptions.map(o => o.value))

      const map: Record<string, string> = {}
      for (const p of paymentsData ?? []) {
        const existing = map[p.month_year]
        if (!existing || (STATUS_PRIORITY[p.status] ?? 0) > (STATUS_PRIORITY[existing] ?? 0)) {
          map[p.month_year] = p.status
        }
      }
      setPaymentMap(map)
    }
    setLoading(false)
  }

  async function checkExisting() {
    setCheckingExisting(true)
    setSuccess(false)
    const { data } = await supabase
      .from('payments')
      .select('id, status, amount, payment_method, rejection_reason, created_at, reference_number')
      .eq('tenant_id', tenant.id)
      .eq('month_year', monthYear)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setExistingPayment(data)
    if (data) {
      setPaymentMap(prev => {
        const existing = prev[monthYear]
        if (!existing || (STATUS_PRIORITY[data.status] ?? 0) > (STATUS_PRIORITY[existing] ?? 0)) {
          return { ...prev, [monthYear]: data.status }
        }
        return prev
      })
    }
    setCheckingExisting(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const { data: myProfile } = await supabase
      .from('profiles').select('linked_landlord_id').eq('id', profile!.id).maybeSingle()

    const { error: payErr } = await supabase.from('payments').insert({
      tenant_id: tenant.id,
      room_id: tenant.room_id,
      amount: parseFloat(amount),
      month_year: monthYear,
      payment_date: now.toISOString().slice(0, 10),
      payment_method: method,
      status: 'pending',
      notes: notes || null,
    })

    if (payErr) { setError(payErr.message); setSubmitting(false); return }

    if (myProfile?.linked_landlord_id) {
      await supabase.from('notifications').insert({
        user_id: myProfile.linked_landlord_id,
        title: 'New Payment Request',
        message: `${tenant.name} submitted a payment of ₱${parseFloat(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} for ${formatMonthYear(monthYear)}`,
        notification_type: 'payment_request',
        is_read: false,
      })
    }

    setPaymentMap(prev => ({ ...prev, [monthYear]: 'pending' }))
    setSubmitting(false)
    setSuccess(true)
    setNotes('')
    checkExisting()
  }

  // Returns display metadata for a month key based on payment status
  function monthMeta(mk: string): {
    badge: string; color: string; bg: string; dot: string; icon: React.ElementType | null
  } {
    const s = paymentMap[mk]
    if (s === 'confirmed' || s === 'verified')
      return { badge: 'Paid', color: '#15803d', bg: 'rgba(52,199,89,0.1)', dot: '#34C759', icon: Check }
    if (s === 'pending')
      return { badge: 'Pending', color: '#b45309', bg: 'rgba(245,158,11,0.1)', dot: '#F59E0B', icon: Clock }
    // No payment
    if (mk < currentMK)
      return { badge: 'Overdue', color: '#b91c1c', bg: 'rgba(255,59,48,0.1)', dot: '#FF3B30', icon: AlertTriangle }
    return { badge: '', color: '#1D1D1F', bg: 'transparent', dot: 'transparent', icon: null }
  }

  const selectedMeta = monthMeta(monthYear)
  const overdueCount = monthOptions.filter(o => monthMeta(o.value).badge === 'Overdue').length

  if (loading) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="h-8 w-44 bg-[#E8E8ED] rounded-xl animate-pulse" />
        <div className="h-52 bg-[#E8E8ED] rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="max-w-lg mx-auto flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-[#F5F5F7] flex items-center justify-center mb-4">
          <AlertCircle size={28} className="text-[#AEAEB2]" />
        </div>
        <h2 className="text-[18px] font-semibold text-[#1D1D1F] mb-2">No room assigned</h2>
        <p className="text-[14px] text-[#6E6E73]">Ask your landlord to assign you to a room first.</p>
      </div>
    )
  }

  const isConfirmed = existingPayment?.status === 'confirmed' || existingPayment?.status === 'verified'
  const isPending = existingPayment?.status === 'pending'
  const isRejected = existingPayment?.status === 'rejected'
  const showForm = !checkingExisting && !isConfirmed && !isPending

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F]">Submit Payment</h1>
        <p className="text-[15px] text-[#6E6E73] mt-0.5">
          Room {tenant.room?.room_number} · {formatCurrency(tenant.per_person_rent)}/mo
        </p>
      </div>

      {/* Overdue alert banner */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background: 'rgba(255,59,48,0.07)', border: '1px solid rgba(255,59,48,0.18)' }}>
          <AlertTriangle size={18} className="text-[#FF3B30] flex-shrink-0" />
          <p className="text-[13px] font-medium text-red-700">
            {overdueCount} overdue {overdueCount === 1 ? 'month' : 'months'} — select a month below to submit payment
          </p>
        </div>
      )}

      {/* Month selector — custom dropdown */}
      <div className="bg-white rounded-2xl border border-[#E8E8ED] p-5" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Select Month</label>

        <div ref={dropdownRef} className="relative">
          {/* Trigger button */}
          <button
            type="button"
            onClick={() => setDropdownOpen(v => !v)}
            className="w-full h-11 rounded-xl px-4 flex items-center justify-between transition-all outline-none"
            style={{
              background: selectedMeta.badge === 'Overdue' ? 'rgba(255,59,48,0.06)' :
                          selectedMeta.badge === 'Pending' ? 'rgba(245,158,11,0.06)' :
                          selectedMeta.badge === 'Paid'    ? 'rgba(52,199,89,0.06)'  : '#F5F5F7',
              border: dropdownOpen ? '2px solid #0071E3' :
                      selectedMeta.badge === 'Overdue' ? '1.5px solid rgba(255,59,48,0.3)' :
                      selectedMeta.badge === 'Pending' ? '1.5px solid rgba(245,158,11,0.3)' :
                      selectedMeta.badge === 'Paid'    ? '1.5px solid rgba(52,199,89,0.3)'  : '1.5px solid transparent',
            }}>
            <div className="flex items-center gap-2.5">
              {selectedMeta.icon && (
                <selectedMeta.icon size={14} style={{ color: selectedMeta.color, flexShrink: 0 }} />
              )}
              <span className="text-[15px] font-medium" style={{ color: selectedMeta.badge ? selectedMeta.color : '#1D1D1F' }}>
                {formatMonthYear(monthYear)}
              </span>
              {selectedMeta.badge && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: selectedMeta.bg, color: selectedMeta.color }}>
                  {selectedMeta.badge}
                </span>
              )}
            </div>
            <ChevronDown size={16} className="text-[#AEAEB2] transition-transform duration-200 flex-shrink-0"
              style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
          </button>

          {/* Dropdown list */}
          {dropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 rounded-2xl overflow-hidden z-20"
              style={{ background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', maxHeight: 320, overflowY: 'auto' }}>
              {monthOptions.map(opt => {
                const meta = monthMeta(opt.value)
                const isSelected = opt.value === monthYear
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setMonthYear(opt.value); setSuccess(false); setDropdownOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                    style={{
                      background: isSelected
                        ? (meta.badge === 'Overdue' ? 'rgba(255,59,48,0.08)' :
                           meta.badge === 'Pending' ? 'rgba(245,158,11,0.08)' :
                           meta.badge === 'Paid'    ? 'rgba(52,199,89,0.08)'  : 'rgba(0,113,227,0.07)')
                        : undefined,
                      borderBottom: '1px solid rgba(0,0,0,0.05)',
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.03)' }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '' }}>

                    {/* Status dot */}
                    <div className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: meta.dot !== 'transparent' ? meta.dot : '#AEAEB2',
                               opacity: meta.dot === 'transparent' ? 0.3 : 1 }} />

                    <span className="flex-1 text-[14px] font-medium" style={{ color: meta.badge ? meta.color : '#1D1D1F' }}>
                      {opt.label}
                    </span>

                    {meta.badge && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: meta.bg, color: meta.color }}>
                        {meta.badge}
                      </span>
                    )}

                    {isSelected && (
                      <Check size={14} className="flex-shrink-0" style={{ color: meta.badge ? meta.color : '#0071E3' }} />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Status for selected month */}
      {checkingExisting && (
        <div className="h-28 bg-[#E8E8ED] rounded-2xl animate-pulse" />
      )}

      {/* Pending state — clean centered card */}
      {!checkingExisting && isPending && (
        <div className="bg-white rounded-2xl border border-[#E8E8ED] overflow-hidden"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          {/* Amber top bar */}
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #FF9500, #FFCC00)' }} />

          <div className="px-6 py-6 flex flex-col items-center text-center">
            {/* Animated clock ring */}
            <div className="relative w-14 h-14 mb-4">
              <div className="absolute inset-0 rounded-full animate-ping opacity-20"
                style={{ background: 'rgba(255,149,0,0.5)' }} />
              <div className="relative w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,149,0,0.1)', border: '1.5px solid rgba(255,149,0,0.25)' }}>
                <Clock size={24} style={{ color: '#FF9500' }} />
              </div>
            </div>

            <p className="text-[17px] font-bold text-[#1D1D1F] mb-1">Pending Approval</p>
            <p className="text-[13px] text-[#6E6E73] max-w-xs leading-relaxed">
              Your landlord is reviewing this submission. You'll be notified once it's confirmed.
            </p>

            {/* Divider */}
            <div className="w-full mt-5 mb-4" style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} />

            {/* Payment details row */}
            <div className="w-full flex items-center justify-between">
              <div className="text-left">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#AEAEB2] mb-0.5">Amount</p>
                <p className="text-[20px] font-bold text-[#1D1D1F] tabular-nums">
                  {formatCurrency(existingPayment.amount)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#AEAEB2] mb-0.5">Month</p>
                <p className="text-[15px] font-semibold text-[#1D1D1F]">{formatMonthYear(monthYear)}</p>
              </div>
            </div>

            {existingPayment.created_at && (
              <p className="text-[12px] text-[#AEAEB2] mt-3">
                Submitted {new Date(existingPayment.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                {' · '}
                {new Date(existingPayment.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Confirmed state */}
      {!checkingExisting && isConfirmed && (
        <div className="bg-white rounded-2xl border border-[#E8E8ED] overflow-hidden"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #34C759, #30D158)' }} />
          <div className="px-6 py-6 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
              style={{ background: 'rgba(52,199,89,0.1)', border: '1.5px solid rgba(52,199,89,0.25)' }}>
              <CheckCircle2 size={24} style={{ color: '#34C759' }} />
            </div>
            <p className="text-[17px] font-bold text-[#1D1D1F] mb-1">Payment Confirmed</p>
            <p className="text-[13px] text-[#6E6E73]">Your landlord has verified this payment.</p>

            <div className="w-full mt-5 mb-4" style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} />
            <div className="w-full flex items-center justify-between">
              <div className="text-left">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#AEAEB2] mb-0.5">Amount</p>
                <p className="text-[20px] font-bold text-[#1D1D1F] tabular-nums">{formatCurrency(existingPayment.amount)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#AEAEB2] mb-0.5">Month</p>
                <p className="text-[15px] font-semibold text-[#1D1D1F]">{formatMonthYear(monthYear)}</p>
              </div>
            </div>
            {existingPayment.created_at && (
              <p className="text-[12px] text-[#AEAEB2] mt-3">
                Submitted {new Date(existingPayment.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Rejected state */}
      {!checkingExisting && isRejected && existingPayment && (
        <div className="flex items-start gap-3 px-4 py-4 rounded-2xl"
          style={{ background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.18)' }}>
          <AlertTriangle size={18} className="text-[#FF3B30] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[14px] font-semibold text-red-700">Payment Declined</p>
            {existingPayment.rejection_reason && (
              <p className="text-[13px] text-red-600 mt-0.5">{existingPayment.rejection_reason}</p>
            )}
            <p className="text-[13px] text-[#6E6E73] mt-1">Please submit a new payment request below.</p>
          </div>
        </div>
      )}

      {success && !existingPayment && (
        <div className="bg-green-50 border border-green-100 rounded-2xl p-5 flex items-center gap-3">
          <CheckCircle2 size={22} className="text-[#34C759] flex-shrink-0" />
          <div>
            <p className="text-[15px] font-semibold text-green-700">Submitted Successfully</p>
            <p className="text-[13px] text-[#6E6E73] mt-0.5">Waiting for your landlord to confirm.</p>
          </div>
        </div>
      )}

      {/* Payment form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-[#E8E8ED] p-6" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <h2 className="text-[17px] font-semibold text-[#1D1D1F] mb-5">Payment Details</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 rounded-xl text-[13px] text-red-600">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6E6E73] font-medium">₱</span>
                <input
                  type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  required min="0" step="0.01"
                  className="w-full h-11 bg-[#F5F5F7] rounded-xl pl-8 pr-4 text-[15px] text-[#1D1D1F] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all"
                />
              </div>
              <p className="text-[12px] text-[#AEAEB2] mt-1.5">Your rent is {formatCurrency(tenant.per_person_rent)}/mo</p>
            </div>

            <div>
              <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Payment Method</label>
              <select
                value={method} onChange={e => setMethod(e.target.value)}
                className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all appearance-none"
              >
                <option value="cash">Cash</option>
                <option value="gcash">GCash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Notes (optional)</label>
              <input
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Reference number, GCash sender name…"
                className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all"
              />
            </div>

            <button
              type="submit" disabled={submitting}
              className="w-full h-12 bg-[#0071E3] text-white rounded-xl font-medium text-[15px] hover:bg-[#0077ED] disabled:opacity-50 transition-colors"
              style={{ boxShadow: '0 4px 12px rgba(0,113,227,0.25)' }}
            >
              {submitting ? 'Submitting…' : 'Submit Payment Request'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
