// @ts-nocheck
import { useEffect, useState, useRef } from 'react'
import {
  CheckCircle2, Clock, AlertTriangle, Info, MessageSquare, Zap,
  BedDouble, ChevronLeft, ChevronRight, CreditCard,
  FileImage, X, Megaphone, Download, Receipt, BellRing, Wrench, Users, Search,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency, fmtMoney, timeAgo } from '@/lib/utils'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function mKey(y: number, m: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}`
}
function fmtMY(mk: string) {
  const [y, m] = mk.split('-')
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`
}
// Parse "YYYY-MM-DD" string directly to avoid UTC-offset timezone bugs
function parseDateStr(dateStr: string | null): { year: number; month: number } | null {
  if (!dateStr) return null
  const parts = dateStr.split('-')
  return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) }
}
function calcPerPerson(rent: number, count: number) {
  if (!rent || rent <= 0) return 0
  return count <= 1 ? Math.max(0, rent - 500) : rent / count
}

const GLASS = {
  background: 'rgba(255,255,255,0.28)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.45)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
}

const STATUS_CFG = {
  paid:     { label: 'Paid',      icon: CheckCircle2,  color: '#34C759', bg: 'rgba(52,199,89,0.08)',  border: '1px solid rgba(52,199,89,0.22)' },
  pending:  { label: 'Pending',   icon: Clock,         color: '#FF9500', bg: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.22)' },
  due_soon: { label: 'Due Soon',  icon: Clock,         color: '#FF9500', bg: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.22)' },
  due_today:{ label: 'Due Today', icon: AlertTriangle, color: '#FF9500', bg: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.22)' },
  overdue:  { label: 'Overdue',   icon: AlertTriangle, color: '#FF3B30', bg: 'rgba(255,59,48,0.08)',  border: '1px solid rgba(255,59,48,0.22)' },
}

const ANN_PRIORITY: Record<string, { label: string; icon: any; accent: string; bg: string; border: string; badgeBg: string }> = {
  urgent:             { label: 'Urgent',            icon: AlertTriangle, accent: '#dc2626', bg: 'rgba(239,68,68,0.07)',    border: 'rgba(239,68,68,0.28)',    badgeBg: 'rgba(239,68,68,0.12)'  },
  reminder:           { label: 'Reminder',          icon: BellRing,      accent: '#7C3AED', bg: 'rgba(124,58,237,0.06)',  border: 'rgba(124,58,237,0.25)',   badgeBg: 'rgba(124,58,237,0.12)' },
  important:          { label: 'Important',         icon: Info,          accent: '#d97706', bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.28)',   badgeBg: 'rgba(245,158,11,0.12)' },
  regular:            { label: 'Announcement',      icon: MessageSquare, accent: '#0071E3', bg: 'rgba(0,113,227,0.05)',   border: 'rgba(0,113,227,0.2)',     badgeBg: 'rgba(0,113,227,0.1)'  },
  visitor_approved:   { label: 'Visitor Approved',  icon: Users,         accent: '#059669', bg: 'rgba(16,185,129,0.07)',  border: 'rgba(16,185,129,0.28)',   badgeBg: 'rgba(16,185,129,0.12)' },
  visitor_rejected:   { label: 'Visitor Rejected',  icon: Users,         accent: '#dc2626', bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.28)',    badgeBg: 'rgba(239,68,68,0.12)'  },
  maintenance_update: { label: 'Maintenance',       icon: Wrench,        accent: '#0071E3', bg: 'rgba(0,113,227,0.05)',   border: 'rgba(0,113,227,0.2)',     badgeBg: 'rgba(0,113,227,0.1)'  },
  payment_confirmed:    { label: 'Payment Confirmed',   icon: CheckCircle2,  accent: '#059669', bg: 'rgba(16,185,129,0.07)',  border: 'rgba(16,185,129,0.28)',   badgeBg: 'rgba(16,185,129,0.12)' },
  payment_rejected:     { label: 'Payment Rejected',    icon: AlertTriangle, accent: '#dc2626', bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.28)',    badgeBg: 'rgba(239,68,68,0.12)'  },
  electricity_reminder: { label: 'Electricity Reminder',icon: Zap,           accent: '#d97706', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.28)',   badgeBg: 'rgba(245,158,11,0.12)' },
  electricity:          { label: 'Electricity Bill',   icon: Zap,           accent: '#d97706', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.28)',   badgeBg: 'rgba(245,158,11,0.12)' },
  electricity_paid:     { label: 'Electricity Paid',   icon: CheckCircle2,  accent: '#059669', bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.28)',   badgeBg: 'rgba(16,185,129,0.12)' },
  rent_reminder:        { label: 'Rent Reminder',       icon: BellRing,      accent: '#7C3AED', bg: 'rgba(124,58,237,0.06)', border: 'rgba(124,58,237,0.25)',   badgeBg: 'rgba(124,58,237,0.12)' },
  rent_overdue:         { label: 'Overdue Rent',         icon: AlertTriangle, accent: '#dc2626', bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.28)',    badgeBg: 'rgba(239,68,68,0.12)'  },
  lost_found:           { label: 'Lost & Found',         icon: Search,        accent: '#7C3AED', bg: 'rgba(124,58,237,0.06)', border: 'rgba(124,58,237,0.25)',   badgeBg: 'rgba(124,58,237,0.12)' },
  lost_found_claim:     { label: 'Lost & Found',         icon: Search,        accent: '#7C3AED', bg: 'rgba(124,58,237,0.06)', border: 'rgba(124,58,237,0.25)',   badgeBg: 'rgba(124,58,237,0.12)' },
  lost_found_accepted:  { label: 'Item Found!',          icon: CheckCircle2,  accent: '#059669', bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.28)',   badgeBg: 'rgba(16,185,129,0.12)' },
  lost_found_rejected:  { label: 'Claim Rejected',       icon: AlertTriangle, accent: '#dc2626', bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.28)',    badgeBg: 'rgba(239,68,68,0.12)'  },
}

// urgent=0, reminder=1, important=2, regular=3
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, reminder: 1, important: 2, regular: 3 }

// ─── Receipt Modal ────────────────────────────────────────────────────────────

function ReceiptModal({ payment, tenant, buildingName, buildingAddress, landlordName, onClose }: {
  payment: any
  tenant: any
  buildingName: string
  buildingAddress: string
  landlordName: string
  onClose: () => void
}) {
  const methodLabel: Record<string, string> = { cash: 'Cash', gcash: 'GCash', bank_transfer: 'Bank Transfer', other: 'Other' }
  const payType = (payment.notes ?? '').toLowerCase().startsWith('electricity') ? 'Electricity' : 'Rent'
  const dateObj = new Date(payment.created_at)
  const dateFmt = dateObj.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
  const timeFmt = dateObj.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })

  function downloadPng() {
    const W = 375, SC = 2
    const details = [
      ['Renter', tenant.name],
      ['Room', tenant.room?.room_number ? `Room ${tenant.room.room_number}` : '—'],
      ['Type', payType],
      ['Period', fmtMY(payment.month_year)],
      ['Method', methodLabel[payment.payment_method ?? ''] ?? (payment.payment_method ?? '—')],
      ['Boarding House', buildingName || '—'],
      ...(buildingAddress ? [['Address', buildingAddress]] : []),
      ['Landlord', landlordName || '—'],
    ]
    const H = 64 + 96 + 18 + details.length * 34 + 80 + 60
    const canvas = document.createElement('canvas')
    canvas.width = W * SC; canvas.height = H * SC
    const ctx = canvas.getContext('2d')!
    ctx.scale(SC, SC)

    // White background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)

    // Blue header
    ctx.fillStyle = '#0071E3'
    ctx.fillRect(0, 0, W, 64)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 20px -apple-system, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('ATIMAN', W / 2, 33)
    ctx.globalAlpha = 0.82
    ctx.font = '11px -apple-system, system-ui, sans-serif'
    ctx.fillText('Official Payment Receipt', W / 2, 52)
    ctx.globalAlpha = 1

    // Reference box
    ctx.fillStyle = '#EBF4FF'
    ctx.fillRect(20, 76, W - 40, 82)
    ctx.fillStyle = '#0071E3'
    ctx.font = 'bold 10px -apple-system, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('REFERENCE NUMBER', W / 2, 100)
    ctx.font = 'bold 22px monospace'
    ctx.fillText(payment.reference_number ?? '—', W / 2, 127)
    ctx.fillStyle = '#AEAEB2'
    ctx.font = '11px -apple-system, system-ui, sans-serif'
    ctx.fillText(dateFmt + '  ·  ' + timeFmt, W / 2, 149)

    // Separator
    ctx.strokeStyle = '#E8E8ED'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(20, 170); ctx.lineTo(W - 20, 170); ctx.stroke()

    // Detail rows
    let y = 192
    for (const [label, val] of details) {
      ctx.fillStyle = '#6E6E73'
      ctx.font = '12px -apple-system, system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(label, 28, y)
      ctx.fillStyle = '#1D1D1F'
      ctx.font = 'bold 12px -apple-system, system-ui, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(String(val), W - 28, y)
      ctx.strokeStyle = '#F0F0F5'
      ctx.lineWidth = 0.5
      ctx.beginPath(); ctx.moveTo(28, y + 10); ctx.lineTo(W - 28, y + 10); ctx.stroke()
      y += 34
    }

    // Amount section
    y += 8
    ctx.fillStyle = '#F0FDF4'
    ctx.fillRect(20, y, W - 40, 56)
    ctx.fillStyle = '#6E6E73'
    ctx.font = '12px -apple-system, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('Amount Paid', 32, y + 27)
    ctx.fillStyle = '#16a34a'
    ctx.font = 'bold 22px -apple-system, system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(formatCurrency(payment.amount), W - 32, y + 33)

    // Footer
    const fy = y + 70
    ctx.strokeStyle = '#E8E8ED'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.moveTo(20, fy); ctx.lineTo(W - 20, fy); ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#AEAEB2'
    ctx.font = '10px -apple-system, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('System-generated receipt from ATIMAN', W / 2, fy + 18)
    ctx.fillText('Boarding House Management System', W / 2, fy + 33)

    canvas.toBlob(blob => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `receipt-${payment.reference_number ?? payment.id}.png`
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 -4px 40px rgba(0,0,0,0.2)' }}>
        <div className="w-10 h-1 rounded-full mx-auto mt-3 sm:hidden" style={{ background: 'rgba(0,0,0,0.12)' }} />

        {/* Blue receipt header */}
        <div className="flex flex-col items-center py-7 px-6" style={{ background: 'rgba(0,113,227,0.06)', borderBottom: '1px solid rgba(0,113,227,0.15)' }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
            style={{ background: 'rgba(0,113,227,0.1)', border: '2px solid rgba(0,113,227,0.2)' }}>
            <Receipt size={28} style={{ color: '#0071E3' }} />
          </div>
          <p className="text-[18px] font-bold text-[#1D1D1F]">Official Receipt</p>
          <p className="text-[13px] text-[#6E6E73] mt-1 text-center">
            Payment confirmed by landlord
          </p>
        </div>

        {/* Reference number — prominent */}
        <div className="mx-5 mt-5 px-4 py-3.5 rounded-2xl text-center"
          style={{ background: 'rgba(0,113,227,0.06)', border: '1px solid rgba(0,113,227,0.18)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6E6E73] mb-1.5">Reference Number</p>
          <p className="text-[20px] font-bold tracking-wide text-[#0071E3] font-mono">
            {payment.reference_number ?? '—'}
          </p>
          <p className="text-[11px] text-[#AEAEB2] mt-1">{dateFmt} · {timeFmt}</p>
        </div>

        {/* Receipt details */}
        <div className="px-5 py-4 space-y-2.5">
          {[
            { label: 'Renter', value: tenant.name },
            { label: 'Room', value: tenant.room?.room_number ? `Room ${tenant.room.room_number}` : '—' },
            { label: 'Type', value: payType },
            { label: 'Period', value: fmtMY(payment.month_year) },
            { label: 'Method', value: methodLabel[payment.payment_method ?? ''] ?? (payment.payment_method ?? '—') },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-[13px] text-[#6E6E73]">{label}</span>
              <span className="text-[13px] font-semibold text-[#1D1D1F]">{value}</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
            <span className="text-[13px] font-bold text-[#1D1D1F]">Amount</span>
            <span className="text-[20px] font-bold text-[#16a34a] tabular-nums">{formatCurrency(payment.amount)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-6 flex gap-2">
          <button onClick={downloadPng}
            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-[14px] font-semibold transition-all"
            style={{ background: 'rgba(0,0,0,0.06)', color: '#1D1D1F' }}>
            <Download size={15} /> Save as PNG
          </button>
          <button onClick={onClose}
            className="flex-1 h-11 rounded-xl text-[14px] font-semibold text-white transition-all"
            style={{ background: '#0071E3', boxShadow: '0 4px 12px rgba(0,113,227,0.3)' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Upload / Pay Modal ───────────────────────────────────────────────────────

function UploadModal({ tenant, payHistory, elecHistory, initialType, initialMonth, onClose, onSuccess }: {
  tenant: any
  payHistory: any[]
  elecHistory: any[]
  initialType: 'rent' | 'electricity'
  initialMonth: string
  onClose: () => void
  onSuccess: () => void
}) {
  const now = new Date()
  const currentMK = mKey(now.getFullYear(), now.getMonth())

  const moveIn = parseDateStr(tenant?.move_in_date)
  const moveInYear = moveIn?.year ?? now.getFullYear()
  const moveInMonth = moveIn?.month ?? 1

  // Initialise year from the pre-selected month key
  const initYear = parseInt(initialMonth.split('-')[0], 10)

  const [payType, setPayType] = useState<'rent' | 'electricity'>(initialType)
  const [selectedMK, setSelectedMK] = useState(initialMonth)
  const [modalYear, setModalYear] = useState(initYear)
  const [method, setMethod] = useState<'cash' | 'gcash' | 'bank_transfer'>('cash')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Year nav bounds — move-in year to next calendar year (advance payment)
  const minModalYear = moveInYear
  const maxModalYear = now.getFullYear() + 1

  // Auto-calculated amounts (never user-editable)
  const rentAmount = Math.round(tenant?.per_person_rent ?? 0)
  const selectedElec = elecHistory.find((e: any) => e.month_year === selectedMK)
  const elecAmount = selectedElec?.share_amount ?? null
  const calculatedAmount = payType === 'rent' ? rentAmount : elecAmount

  const needsReceipt = method === 'gcash' || method === 'bank_transfer'

  function getMonthPayStatus(mk: string, type: 'rent' | 'electricity' = 'rent') {
    const pays = payHistory.filter((p: any) => {
      if (p.month_year !== mk) return false
      const isElec = (p.notes ?? '').toLowerCase().startsWith('electricity')
      return type === 'electricity' ? isElec : !isElec
    })
    if (pays.some((p: any) => p.status === 'confirmed' || p.status === 'verified')) return 'paid'
    if (pays.some((p: any) => p.status === 'pending')) return 'pending'
    if (pays.some((p: any) => p.status === 'rejected')) return 'rejected'
    return 'none'
  }

  function isMonthBeforeMoveIn(year: number, month: number) {
    return year < moveInYear || (year === moveInYear && month < moveInMonth)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setReceiptFile(file)
    const reader = new FileReader()
    reader.onload = ev => setReceiptPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSubmit() {
    if (!calculatedAmount || calculatedAmount <= 0) {
      setError(payType === 'electricity' ? 'No electricity bill for this month.' : 'Rent amount unavailable.')
      return
    }
    if (needsReceipt && !receiptFile) { setError('Please upload your receipt.'); return }
    setSubmitting(true); setError('')

    let receiptUrl: string | null = null
    if (receiptFile) {
      const ext = receiptFile.name.split('.').pop()
      const path = `${tenant.id}/${selectedMK}-${payType}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('receipts').upload(path, receiptFile, { upsert: true })
      if (upErr) { setError(`Failed to upload receipt: ${upErr.message}`); setSubmitting(false); return }
      const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path)
      receiptUrl = urlData?.publicUrl ?? null
    }

    const payNotes = payType === 'electricity'
      ? `Electricity bill${notes ? ' · ' + notes : ''}`
      : (notes || null)

    const { error: insertErr } = await supabase.from('payments').insert({
      tenant_id: tenant.id,
      room_id: tenant.room_id,
      amount: calculatedAmount,
      month_year: selectedMK,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: method,
      status: 'pending',
      receipt_url: receiptUrl,
      notes: payNotes,
    })

    if (insertErr) { setError('Failed to submit. Try again.'); setSubmitting(false); return }

    if (tenant.room?.building_id) {
      const { data: bldg } = await supabase.from('buildings').select('landlord_id').eq('id', tenant.room.building_id).maybeSingle()
      if (bldg?.landlord_id) {
        await supabase.from('notifications').insert({
          user_id: bldg.landlord_id,
          title: 'New Payment Submitted',
          message: `${tenant.name} submitted ${formatCurrency(calculatedAmount)} for ${fmtMY(selectedMK)} (${payType === 'electricity' ? 'Electricity' : 'Rent'}) via ${method.replace('_', ' ')}.`,
          notification_type: 'payment_submitted',
        })
      }
    }

    setSubmitting(false)
    setSubmitted(true)
  }

  // Room info display (graceful when room data is missing)
  const roomLabel = tenant.room?.room_number ? `Room ${tenant.room.room_number}` : 'Your Room'
  const occupantsLabel = (tenant.room_occupants ?? 1) > 1 ? `${tenant.room_occupants} occupants` : 'Solo'

  if (submitted) {
    const isElec = payType === 'electricity'
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onSuccess} />
        <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 -4px 40px rgba(0,0,0,0.15)' }}>
          <div className="w-10 h-1 rounded-full mx-auto mt-3 sm:hidden" style={{ background: 'rgba(0,0,0,0.12)' }} />
          <div className="flex flex-col items-center py-12 px-8 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={isElec
                ? { background: 'rgba(255,149,0,0.1)', border: '2px solid rgba(255,149,0,0.3)' }
                : { background: 'rgba(52,199,89,0.1)', border: '2px solid rgba(52,199,89,0.25)' }}>
              {isElec
                ? <Zap size={32} style={{ color: '#FF9500' }} />
                : <CheckCircle2 size={32} style={{ color: '#34C759' }} />}
            </div>

            {isElec ? (
              <>
                <p className="text-[22px] font-bold text-[#1D1D1F] mb-2">Thank you for paying!</p>
                <p className="text-[14px] text-[#6E6E73] leading-relaxed mb-3">
                  Your electricity payment for{' '}
                  <span className="font-semibold text-[#1D1D1F]">{fmtMY(selectedMK)}</span>{' '}
                  has been submitted successfully.
                </p>
                <div className="w-full rounded-2xl px-5 py-4 mb-8 text-left space-y-2"
                  style={{ background: 'rgba(255,149,0,0.07)', border: '1px solid rgba(255,149,0,0.2)' }}>
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: 'rgba(255,149,0,0.15)' }}>
                      <span className="text-[10px] font-bold text-amber-600">1</span>
                    </div>
                    <p className="text-[13px] text-amber-800 font-medium leading-snug">Your payment is currently <span className="font-bold">pending review.</span></p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: 'rgba(255,149,0,0.15)' }}>
                      <span className="text-[10px] font-bold text-amber-600">2</span>
                    </div>
                    <p className="text-[13px] text-amber-800 leading-snug">Your landlord will review and <span className="font-semibold">approve it shortly.</span></p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: 'rgba(255,149,0,0.15)' }}>
                      <span className="text-[10px] font-bold text-amber-600">3</span>
                    </div>
                    <p className="text-[13px] text-amber-800 leading-snug">You'll receive a <span className="font-semibold">notification</span> once your payment is confirmed.</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-[22px] font-bold text-[#1D1D1F] mb-2">Payment Submitted!</p>
                <p className="text-[14px] text-[#6E6E73] leading-relaxed mb-2">
                  Your payment for <span className="font-semibold text-[#1D1D1F]">{fmtMY(selectedMK)}</span> is pending landlord approval.
                </p>
                <p className="text-[13px] text-[#AEAEB2] mb-8">
                  Once approved, your official receipt will be available in Payment History.
                </p>
              </>
            )}

            <button onClick={onSuccess}
              className="w-full h-12 rounded-xl text-white font-semibold text-[15px]"
              style={isElec
                ? { background: '#FF9500', boxShadow: '0 4px 12px rgba(255,149,0,0.35)' }
                : { background: '#0071E3', boxShadow: '0 4px 12px rgba(0,113,227,0.3)' }}>
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 -4px 40px rgba(0,0,0,0.15)', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="w-10 h-1 rounded-full mx-auto mt-3 sm:hidden" style={{ background: 'rgba(0,0,0,0.12)' }} />
        <div className="flex items-center justify-between px-6 pt-5 pb-4"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
          <div>
            <h2 className="text-[18px] font-bold text-[#1D1D1F]">Submit Payment</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ background: 'rgba(0,0,0,0.06)' }}>
            <X size={15} className="text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Pay type toggle */}
          <div className="flex gap-1.5 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.05)' }}>
            {(['rent', 'electricity'] as const).map(t => (
              <button key={t} onClick={() => setPayType(t)}
                className="flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all"
                style={payType === t
                  ? { background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', color: '#1D1D1F' }
                  : { color: '#6E6E73' }}>
                {t === 'rent' ? 'Rent' : 'Electricity'}
              </button>
            ))}
          </div>

          {/* Payment type label — prominent badge */}
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl"
            style={payType === 'electricity'
              ? { background: 'rgba(255,149,0,0.09)', border: '1px solid rgba(255,149,0,0.25)' }
              : { background: 'rgba(0,113,227,0.07)', border: '1px solid rgba(0,113,227,0.2)' }}>
            {payType === 'electricity'
              ? <Zap size={15} style={{ color: '#FF9500', flexShrink: 0 }} />
              : <CreditCard size={15} style={{ color: '#0071E3', flexShrink: 0 }} />}
            <p className="text-[13px] font-semibold" style={{ color: payType === 'electricity' ? '#b45309' : '#0071E3' }}>
              {payType === 'electricity' ? 'Electricity Payment' : 'Rent Payment'}
            </p>
          </div>

          {/* Pending payment notice — inline banner, no nested overlay */}
          {(() => {
            const existingStatus = getMonthPayStatus(selectedMK, payType)
            if (existingStatus !== 'pending') return null
            return (
              <div className="rounded-2xl flex flex-col items-center px-6 py-8 text-center"
                style={{ background: 'rgba(255,149,0,0.07)', border: '1px solid rgba(255,149,0,0.25)' }}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                  style={{ background: 'rgba(255,149,0,0.12)', border: '2px solid rgba(255,149,0,0.3)' }}>
                  <Clock size={26} style={{ color: '#FF9500' }} />
                </div>
                <p className="text-[16px] font-bold text-[#1D1D1F] mb-1">Payment Pending Approval</p>
                <p className="text-[13px] text-[#6E6E73] leading-relaxed">
                  Please wait while the landlord reviews your submission.
                </p>
                <p className="text-[12px] text-[#AEAEB2] mt-1">
                  You cannot submit again until it is processed.
                </p>
              </div>
            )
          })()}

          {/* Paid status banner — shown inline when month is already confirmed */}
          {(() => {
            const existingStatus = getMonthPayStatus(selectedMK, payType)
            if (existingStatus !== 'paid') return null
            return (
              <div className="rounded-xl flex items-start gap-3 p-4"
                style={{ background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.25)' }}>
                <CheckCircle2 size={18} style={{ color: '#34C759', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p className="text-[14px] font-bold" style={{ color: '#15803d' }}>
                    {payType === 'electricity' ? 'Electricity' : 'Rent'} Payment Confirmed
                  </p>
                  <p className="text-[12px] text-[#6E6E73] mt-0.5">This month has already been paid and confirmed.</p>
                </div>
              </div>
            )
          })()}

          {/* Month grid — Jan → Dec per year, with year navigation */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#6E6E73] mb-2">Select Month</label>
            <div className="flex items-center justify-between mb-2.5">
              <button onClick={() => setModalYear(y => y - 1)} disabled={modalYear <= minModalYear}
                className="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-25 transition-opacity"
                style={{ background: 'rgba(0,0,0,0.06)' }}>
                <ChevronLeft size={14} className="text-slate-500" />
              </button>
              <span className="text-[15px] font-bold text-[#1D1D1F] tabular-nums">{modalYear}</span>
              <button onClick={() => setModalYear(y => y + 1)} disabled={modalYear >= maxModalYear}
                className="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-25 transition-opacity"
                style={{ background: 'rgba(0,0,0,0.06)' }}>
                <ChevronRight size={14} className="text-slate-500" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 12 }, (_, i) => {
                const monthNum = i + 1
                const mk = mKey(modalYear, i)
                const hasElecBillForMk = payType === 'electricity'
                  ? elecHistory.some((e: any) => e.month_year === mk)
                  : true
                const disabled = isMonthBeforeMoveIn(modalYear, monthNum) || (payType === 'electricity' && !hasElecBillForMk)
                const payStatus = getMonthPayStatus(mk, payType)
                const isSelected = selectedMK === mk
                const isCurrent = mk === currentMK

                const isOverdue = !disabled && payStatus === 'none' && mk < currentMK

                let bg = '#F5F5F7', color = '#6E6E73', borderStyle = '1.5px solid transparent'
                if (isSelected)                                { bg = '#0071E3'; color = '#fff'; borderStyle = '1.5px solid #0071E3' }
                else if (!disabled && payStatus === 'paid')    { bg = 'rgba(52,199,89,0.1)';   color = '#15803d'; borderStyle = '1.5px solid rgba(52,199,89,0.3)' }
                else if (!disabled && payStatus === 'pending') { bg = 'rgba(255,149,0,0.1)';   color = '#b45309'; borderStyle = '1.5px solid rgba(255,149,0,0.3)' }
                else if (isOverdue)                            { bg = 'rgba(255,59,48,0.08)';  color = '#b91c1c'; borderStyle = '1.5px solid rgba(255,59,48,0.28)' }
                else if (isCurrent && !disabled)               { borderStyle = '1.5px solid rgba(0,113,227,0.35)' }

                return (
                  <button key={mk}
                    onClick={() => { if (!disabled) { setSelectedMK(mk) } }}
                    disabled={disabled}
                    className="flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all active:scale-95"
                    style={{ background: bg, color, border: borderStyle, opacity: disabled ? 0.2 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
                    <span className="text-[12px] font-bold leading-none">{MONTH_SHORT[i]}</span>
                    {payStatus === 'paid' && !isSelected && !disabled && <CheckCircle2 size={9} style={{ color: '#34C759' }} />}
                    {payStatus === 'pending' && !isSelected && !disabled && <Clock size={9} style={{ color: '#FF9500' }} />}
                    {isOverdue && !isSelected && <AlertTriangle size={9} style={{ color: '#FF3B30' }} />}
                    {isSelected && <CheckCircle2 size={9} className="text-white opacity-80" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Calculated amount (read-only, auto-computed) */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#6E6E73] mb-2">Amount</label>
            {calculatedAmount != null && calculatedAmount > 0 ? (
              <div className="flex items-center justify-between px-5 py-4 rounded-xl"
                style={{ background: '#F5F5F7' }}>
                <div>
                  <p className="text-[12px] text-[#6E6E73] font-medium">
                    {payType === 'rent'
                      ? `${roomLabel} · ${occupantsLabel}`
                      : `Electricity · ${fmtMY(selectedMK)}`}
                  </p>
                  <p className="text-[11px] text-[#AEAEB2] mt-0.5">Auto-calculated</p>
                </div>
                <p className="text-[28px] font-bold tabular-nums text-[#1D1D1F]">{formatCurrency(calculatedAmount)}</p>
              </div>
            ) : (
              <div className="px-5 py-4 rounded-xl flex items-center gap-2.5"
                style={{ background: 'rgba(255,149,0,0.08)', border: '1px solid rgba(255,149,0,0.22)' }}>
                <Clock size={14} className="text-amber-600 flex-shrink-0" />
                <p className="text-[13px] text-amber-700 font-medium">
                  {payType === 'electricity'
                    ? 'No electricity bill posted for this month.'
                    : 'Rent data not available — contact your landlord.'}
                </p>
              </div>
            )}
          </div>

          {/* Payment method */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#6E6E73] mb-2">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {([['cash','Cash'],['gcash','GCash'],['bank_transfer','Bank']] as [string,string][]).map(([val, lbl]) => (
                <button key={val} onClick={() => setMethod(val as any)}
                  className="py-2.5 rounded-xl text-[13px] font-semibold transition-all"
                  style={method === val ? { background: '#0071E3', color: '#fff' } : { background: '#F5F5F7', color: '#6E6E73' }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Receipt upload (GCash / Bank only) */}
          {needsReceipt && (
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#6E6E73] mb-2">Receipt</label>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              {receiptPreview ? (
                <div className="relative rounded-xl overflow-hidden" style={{ height: 130 }}>
                  <img src={receiptPreview} alt="receipt" className="w-full h-full object-cover" />
                  <button onClick={() => { setReceiptFile(null); setReceiptPreview(null) }}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="w-full h-24 rounded-xl flex flex-col items-center justify-center gap-2"
                  style={{ background: '#F5F5F7', border: '1.5px dashed #D2D2D7' }}>
                  <FileImage size={20} className="text-[#AEAEB2]" />
                  <span className="text-[12px] text-[#AEAEB2]">Tap to upload receipt</span>
                </button>
              )}
            </div>
          )}

          {error && <p className="text-[12px] text-red-500 font-medium">{error}</p>}

          {(() => {
            const existingStatus = getMonthPayStatus(selectedMK, payType)
            const isPaid = existingStatus === 'paid'
            const isPending = existingStatus === 'pending'
            const isBlocked = isPaid || isPending

            if (isBlocked) {
              return (
                <div className="rounded-xl overflow-hidden"
                  style={{ border: isPaid ? '1px solid rgba(52,199,89,0.25)' : '1px solid rgba(255,149,0,0.25)' }}>
                  <div className="flex items-start gap-3 p-4"
                    style={{ background: isPaid ? 'rgba(52,199,89,0.08)' : 'rgba(255,149,0,0.08)' }}>
                    {isPaid
                      ? <CheckCircle2 size={18} style={{ color: '#34C759', flexShrink: 0, marginTop: 1 }} />
                      : <Clock size={18} style={{ color: '#FF9500', flexShrink: 0, marginTop: 1 }} />}
                    <div>
                      <p className="text-[14px] font-bold" style={{ color: isPaid ? '#15803d' : '#b45309' }}>
                        {isPaid
                          ? `${payType === 'electricity' ? 'Electricity' : 'Rent'} Payment Confirmed`
                          : 'Payment Pending Approval'}
                      </p>
                      <p className="text-[12px] text-[#6E6E73] mt-0.5">
                        {isPaid
                          ? 'This month has already been paid and confirmed.'
                          : 'Please wait while the landlord reviews your submission. You cannot submit again until it is processed.'}
                      </p>
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <button onClick={handleSubmit} disabled={submitting || !calculatedAmount || calculatedAmount <= 0}
                className="w-full h-12 rounded-xl text-white font-semibold text-[15px] transition-all"
                style={{
                  background: submitting || !calculatedAmount || calculatedAmount <= 0 ? '#AEAEB2' : '#0071E3',
                  boxShadow: submitting || !calculatedAmount || calculatedAmount <= 0 ? 'none' : '0 4px 12px rgba(0,113,227,0.3)',
                }}>
                {submitting ? 'Submitting…' : 'Submit Payment'}
              </button>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// ─── Month Detail Modal ───────────────────────────────────────────────────────

function MonthDetailModal({ cell, payHistory, elecHistory, tenant, buildingName, buildingAddress, landlordName, onClose, onUpload }: {
  cell: any
  payHistory: any[]
  elecHistory: any[]
  tenant: any
  buildingName: string
  buildingAddress: string
  landlordName: string
  onClose: () => void
  onUpload: (type: 'rent' | 'electricity', mk: string) => void
}) {
  const { mk, isMoveIn, focusType = 'rent' } = cell
  const [y, m] = mk.split('-')
  const fullMonth = MONTH_NAMES[parseInt(m, 10) - 1]
  const now = new Date()
  const isFuture = new Date(parseInt(y), parseInt(m) - 1, 1) > new Date(now.getFullYear(), now.getMonth(), 1)
  const [showReceipt, setShowReceipt] = useState<any>(null)

  const allPays = payHistory.filter((p: any) => p.month_year === mk)
  const rentPays = allPays.filter((p: any) => !(p.notes ?? '').toLowerCase().startsWith('electricity'))
  const elecPays = allPays.filter((p: any) => (p.notes ?? '').toLowerCase().startsWith('electricity'))

  const confirmedPay = rentPays.find((p: any) => p.status === 'confirmed' || p.status === 'verified')
  const pendingPay = rentPays.find((p: any) => p.status === 'pending')
  const displayPay = confirmedPay ?? pendingPay ?? null

  const elecConfirmedPay = elecPays.find((p: any) => p.status === 'confirmed' || p.status === 'verified')
  const elecPendingPay = elecPays.find((p: any) => p.status === 'pending')
  const displayElecPay = elecConfirmedPay ?? elecPendingPay ?? null

  const elecEntry = elecHistory.find((e: any) => e.month_year === mk) ?? null

  const payScKey = displayPay
    ? (displayPay.status === 'confirmed' || displayPay.status === 'verified' ? 'paid' : 'pending')
    : null
  const paySC = payScKey ? STATUS_CFG[payScKey] : null
  const PayIcon = paySC?.icon ?? null

  const elecScKey = displayElecPay
    ? (displayElecPay.status === 'confirmed' || displayElecPay.status === 'verified' ? 'paid' : 'pending')
    : null
  const elecSC = elecScKey ? STATUS_CFG[elecScKey] : null
  const ElecPayIcon = elecSC?.icon ?? null

  const canUploadRent = !isFuture && !confirmedPay
  const canUploadElec = !isFuture && !!elecEntry && !elecConfirmedPay

  function fmtTs(ts: string | null | undefined) {
    if (!ts) return null
    const d = new Date(ts)
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
      + ' · ' + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <>
      {showReceipt && (
        <ReceiptModal
          payment={showReceipt}
          tenant={tenant}
          buildingName={buildingName}
          buildingAddress={buildingAddress}
          landlordName={landlordName}
          onClose={() => setShowReceipt(null)}
        />
      )}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6 pb-10 sm:pb-6"
          style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 -8px 40px rgba(0,0,0,0.18)' }}>
          <div className="w-10 h-1 rounded-full mx-auto mb-4 sm:hidden" style={{ background: 'rgba(0,0,0,0.12)' }} />
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl" style={{ background: 'rgba(0,0,0,0.06)' }}>
            <X size={15} className="text-slate-500" />
          </button>

          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#AEAEB2] mb-0.5">{y}</p>
          <h2 className="text-[24px] font-bold text-[#1D1D1F] mb-4">{fullMonth}</h2>

          {isMoveIn && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4"
              style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
              <span className="text-[13px] font-semibold text-blue-600">Move-in Month</span>
            </div>
          )}

          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#6E6E73] mb-2">Rent Payment</p>
            {isFuture && !displayPay ? (
              <p className="text-[13px] text-[#AEAEB2] italic px-1">Not yet due</p>
            ) : displayPay ? (
              <div className="rounded-xl overflow-hidden" style={{ border: paySC?.border }}>
                <div className="p-3.5" style={{ background: paySC?.bg }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        {PayIcon && <PayIcon size={13} style={{ color: paySC?.color }} />}
                        <span className="text-[13px] font-semibold" style={{ color: paySC?.color }}>{paySC?.label}</span>
                      </div>
                      {displayPay.payment_method && (
                        <p className="text-[12px] text-[#6E6E73] capitalize">{displayPay.payment_method.replace('_', ' ')}</p>
                      )}
                      {fmtTs(displayPay.created_at) && (
                        <p className="text-[12px] text-[#AEAEB2]">{fmtTs(displayPay.created_at)}</p>
                      )}
                      {displayPay.reference_number && (
                        <p className="text-[11px] font-mono mt-0.5" style={{ color: '#0071E3' }}>{displayPay.reference_number}</p>
                      )}
                    </div>
                    <p className="text-[22px] font-bold tabular-nums text-[#1D1D1F] flex-shrink-0">{formatCurrency(displayPay.amount)}</p>
                  </div>
                </div>
                {confirmedPay && (
                  <button onClick={() => setShowReceipt(confirmedPay)}
                    className="w-full flex items-center justify-center gap-1.5 h-9 text-[13px] font-semibold transition-all"
                    style={{ background: 'rgba(0,113,227,0.07)', color: '#0071E3', borderTop: '1px solid rgba(0,113,227,0.12)' }}>
                    <Receipt size={13} /> View Receipt
                  </button>
                )}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl flex items-center gap-1.5"
                style={{ background: 'rgba(255,59,48,0.07)', border: '1px solid rgba(255,59,48,0.18)' }}>
                <AlertTriangle size={13} className="text-red-500" />
                <span className="text-[13px] font-semibold text-red-600">No payment recorded</span>
              </div>
            )}
          </div>

          <div className="mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#6E6E73] mb-2">Electricity</p>
            {elecEntry ? (
              <div className="rounded-xl overflow-hidden" style={{ border: elecSC?.border ?? '1px solid rgba(255,149,0,0.2)' }}>
                <div className="p-3.5" style={{ background: elecSC?.bg ?? 'rgba(255,149,0,0.08)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {ElecPayIcon
                        ? <ElecPayIcon size={13} style={{ color: elecSC?.color }} />
                        : <Zap size={13} className="text-[#FF9500]" />}
                      <span className="text-[13px] font-semibold" style={{ color: elecSC?.color ?? '#b45309' }}>
                        {displayElecPay
                          ? (elecScKey === 'paid' ? 'Electricity Paid' : 'Electricity Pending')
                          : 'Your share'}
                      </span>
                    </div>
                    <p className="text-[20px] font-bold tabular-nums text-[#1D1D1F]">{formatCurrency(elecEntry.share_amount)}</p>
                  </div>
                  {displayElecPay?.payment_method && (
                    <p className="text-[12px] text-[#6E6E73] mt-1 capitalize">{displayElecPay.payment_method.replace('_', ' ')}</p>
                  )}
                  {displayElecPay?.reference_number && (
                    <p className="text-[11px] font-mono mt-0.5" style={{ color: '#0071E3' }}>{displayElecPay.reference_number}</p>
                  )}
                </div>
                {elecConfirmedPay && (
                  <button onClick={() => setShowReceipt(elecConfirmedPay)}
                    className="w-full flex items-center justify-center gap-1.5 h-9 text-[13px] font-semibold transition-all"
                    style={{ background: 'rgba(0,113,227,0.07)', color: '#0071E3', borderTop: '1px solid rgba(0,113,227,0.12)' }}>
                    <Receipt size={13} /> View Receipt
                  </button>
                )}
              </div>
            ) : (
              <p className="text-[13px] text-[#AEAEB2] italic px-1">No electricity bill posted</p>
            )}
          </div>

          <div className="space-y-2">
            {canUploadRent && focusType !== 'electricity' && (
              <button
                onClick={() => { onClose(); onUpload('rent', mk) }}
                className="w-full h-11 rounded-xl text-white font-semibold text-[14px] transition-all"
                style={{ background: '#0071E3', boxShadow: '0 4px 12px rgba(0,113,227,0.25)' }}>
                Pay Rent for {MONTH_SHORT[parseInt(m, 10) - 1]}
              </button>
            )}
            {canUploadElec && (
              <button
                onClick={() => { onClose(); onUpload('electricity', mk) }}
                className="w-full h-11 rounded-xl text-white font-semibold text-[14px] transition-all flex items-center justify-center gap-2"
                style={{ background: '#FF9500', boxShadow: '0 4px 12px rgba(255,149,0,0.25)' }}>
                <Zap size={15} /> Pay Electricity
              </button>
            )}
            {canUploadRent && focusType === 'electricity' && (
              <button
                onClick={() => { onClose(); onUpload('rent', mk) }}
                className="w-full h-11 rounded-xl font-semibold text-[14px] transition-all"
                style={{ background: 'rgba(0,113,227,0.08)', color: '#0071E3', border: '1px solid rgba(0,113,227,0.2)' }}>
                Also Pay Rent for {MONTH_SHORT[parseInt(m, 10) - 1]}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RenterHome() {
  const { profile } = useAuth()
  const now = new Date()
  const currentMK = mKey(now.getFullYear(), now.getMonth())

  const [loading, setLoading] = useState(true)
  const [tenant, setTenant] = useState<any>(null)
  const [roommates, setRoommates] = useState<string[]>([])
  const [buildingName, setBuildingName] = useState('')
  const [buildingAddress, setBuildingAddress] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending' | 'overdue' | 'due_soon' | null>(null)
  const [electricityShare, setElectricityShare] = useState<number | null>(null)
  const [elecMonth, setElecMonth] = useState<string | null>(null)
  const [unacked, setUnacked] = useState<any[]>([])
  const [acked, setAcked] = useState<any[]>([])
  const [payHistory, setPayHistory] = useState<any[]>([])
  const [elecHistory, setElecHistory] = useState<any[]>([])
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadPresetType, setUploadPresetType] = useState<'rent' | 'electricity'>('rent')
  const [uploadPresetMonth, setUploadPresetMonth] = useState(currentMK)
  const [selectedCell, setSelectedCell] = useState<any>(null)
  const [calendarTab, setCalendarTab] = useState<'rent' | 'electricity'>('rent')
  const [viewNotif, setViewNotif] = useState<any>(null)

  useEffect(() => {
    if (!profile?.id) return
    init()
    const sub = supabase
      .channel(`renter-home-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tenants' }, () => init())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => init())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => init())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => init())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => init())
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, () => init())
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [profile?.id])

  async function init() {
    setLoading(true)

    // Fetch tenant WITHOUT a nested room join — rooms RLS may block it.
    // Room data is fetched separately in the Promise.all below.
    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('id, name, room_id, move_in_date')
      .eq('user_id', profile!.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!tenantRow) { setLoading(false); return }

    const fetchRoommates = async () => {
      const rpc = await supabase.rpc('get_room_occupants', { p_room_id: tenantRow.room_id })
      if (!rpc.error && rpc.data) return rpc
      return supabase.from('tenants').select('id, name, occupants').eq('room_id', tenantRow.room_id).eq('is_active', true)
    }

    const [
      { data: roomData },
      { data: roomTenantsRaw },
      { data: currentPayment },
      { data: elecShareRow },
      { data: announcementsRaw },
      { data: readsRaw },
      { data: payHistoryRaw },
      { data: elecHistoryRaw },
      { data: remindersRaw },
    ] = await Promise.all([
      // Explicit room fetch — works once the "Renters can view their own room" RLS policy is in place
      tenantRow.room_id
        ? supabase
            .from('rooms')
            .select('id, room_number, rent_amount, building_id, building:buildings(name, address)')
            .eq('id', tenantRow.room_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      fetchRoommates(),
      supabase
        .from('payments')
        .select('status, created_at')
        .eq('tenant_id', tenantRow.id)
        .eq('month_year', currentMK)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('electricity_shares')
        .select('share_amount, occupants, bill:electricity_bills(month_year)')
        .eq('tenant_id', tenantRow.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      profile!.linked_landlord_id
        ? supabase
            .from('announcements')
            .select('id, title, message, is_pinned, created_at, updated_at, priority')
            .eq('landlord_id', profile!.linked_landlord_id)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      supabase
        .from('announcement_reads')
        .select('announcement_id')
        .eq('user_id', profile!.id)
        .then(res => res.error ? { data: [] } : res),
      supabase
        .from('payments')
        .select('id, month_year, amount, status, payment_method, payment_date, created_at, reference_number, notes')
        .eq('tenant_id', tenantRow.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('electricity_shares')
        .select('share_amount, bill:electricity_bills(month_year)')
        .eq('tenant_id', tenantRow.id),
      supabase
        .from('notifications')
        .select('id, title, message, notification_type, created_at')
        .eq('user_id', profile!.id)
        .in('notification_type', [
          'rent_reminder', 'rent_overdue',
          'electricity_reminder', 'electricity', 'electricity_paid',
          'visitor_approved', 'visitor_rejected',
          'maintenance_update',
          'payment_confirmed', 'payment_rejected',
        ])
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .then(res => res.error ? { data: [] } : res),
    ])

    // Occupancy and per-person rent — sum occupants across all active tenants in the room
    const allInRoom = roomTenantsRaw ?? []
    const roomOccupants = Math.max(1, allInRoom.reduce((s: number, t: any) => s + (t.occupants ?? 1), 0))
    const perPersonRent = calcPerPerson(roomData?.rent_amount ?? 0, roomOccupants)
    const mates = allInRoom.filter((t: any) => t.id !== tenantRow.id).map((t: any) => t.name)

    setTenant({ ...tenantRow, room: roomData ?? null, per_person_rent: perPersonRent, room_occupants: roomOccupants })
    setRoommates(mates)

    // Building name + address — from the room's building join, fallback to landlord's first building
    const bldgData = (roomData as any)?.building
    const nameFromRoom = bldgData?.name ?? ''
    if (nameFromRoom) {
      setBuildingName(nameFromRoom)
      setBuildingAddress(bldgData?.address ?? '')
    } else if (profile!.linked_landlord_id) {
      const { data: fallbackBldg } = await supabase
        .from('buildings')
        .select('name, address')
        .eq('landlord_id', profile!.linked_landlord_id)
        .limit(1)
        .maybeSingle()
      setBuildingName(fallbackBldg?.name ?? '')
      setBuildingAddress(fallbackBldg?.address ?? '')
    }

    // Payment status: check ALL months from move-in first, then current month
    const mi = parseDateStr(tenantRow.move_in_date)
    let hasPastOverdue = false
    if (mi) {
      const confirmedKeys = new Set(
        (payHistoryRaw ?? [])
          .filter((p: any) => (p.status === 'confirmed' || p.status === 'verified') && !(p.notes ?? '').toLowerCase().startsWith('electricity'))
          .map((p: any) => p.month_year)
      )
      const d = new Date(mi.year, mi.month - 1, 1) // start of move-in month
      d.setMonth(d.getMonth() + 1)                  // move-in month is covered by deposit → start from next month
      const currentMKStr = mKey(now.getFullYear(), now.getMonth())
      while (true) {
        const mk = mKey(d.getFullYear(), d.getMonth())
        if (mk >= currentMKStr) break
        if (!confirmedKeys.has(mk)) { hasPastOverdue = true; break }
        d.setMonth(d.getMonth() + 1)
      }
    }
    if (hasPastOverdue) {
      setPaymentStatus('overdue')
    } else if (!currentPayment) {
      const dueDay = tenantRow.move_in_date
        ? new Date(tenantRow.move_in_date + 'T00:00:00').getDate()
        : 1
      const today = now.getDate()
      if (today < dueDay) setPaymentStatus('due_soon')
      else if (today === dueDay) setPaymentStatus('due_today')
      else setPaymentStatus('overdue')
    } else if (currentPayment.status === 'confirmed' || currentPayment.status === 'verified') {
      setPaymentStatus('paid')
    } else if (currentPayment.status === 'pending') {
      setPaymentStatus('pending')
    } else {
      setPaymentStatus('overdue')
    }

    if (elecShareRow) {
      setElectricityShare(elecShareRow.share_amount)
      setElecMonth(elecShareRow.bill?.month_year ?? null)
    }

    // Unified unacked = announcements (unread) + reminders (unread notifications)
    const readIds = new Set((readsRaw ?? []).map((r: any) => r.announcement_id))
    const allAnns = announcementsRaw ?? []

    // Priority order: 0=Urgent, 1=Important, 2=Announcements(urgent), 3=Announcements(important), 4=Announcements(regular), 5=Informational
    const ANN_SORT: Record<string, number> = { urgent: 2, important: 3, regular: 4 }
    const unackedAnns = allAnns
      .filter((a: any) => !readIds.has(a.id))
      .map((a: any) => ({ ...a, kind: 'announcement', sortOrder: ANN_SORT[a.priority ?? 'regular'] ?? 4 }))

    const NOTIF_SORT: Record<string, number> = {
      rent_overdue: 0, visitor_rejected: 0, payment_rejected: 0, lost_found_rejected: 0,
      rent_reminder: 1, electricity_reminder: 1, visitor_approved: 1, payment_confirmed: 1, lost_found_accepted: 1,
      lost_found: 2, lost_found_claim: 2,
      maintenance_update: 5,
    }
    const unackedReminders = (remindersRaw ?? []).map((r: any) => ({
      ...r,
      kind: 'notification',
      priority: r.notification_type,
      sortOrder: NOTIF_SORT[r.notification_type] ?? 5,
    }))

    setUnacked(
      [...unackedAnns, ...unackedReminders].sort((a: any, b: any) =>
        a.sortOrder !== b.sortOrder
          ? a.sortOrder - b.sortOrder
          : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    )
    setAcked(
      allAnns
        .filter((a: any) => readIds.has(a.id))
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    )

    setPayHistory(payHistoryRaw ?? [])
    setElecHistory(
      (elecHistoryRaw ?? [])
        .map((e: any) => ({ month_year: e.bill?.month_year, share_amount: e.share_amount }))
        .filter((e: any) => e.month_year)
    )
    setLoading(false)
  }

  async function acknowledgeItem(item: any) {
    if (item.kind === 'notification' || item.kind === 'reminder') {
      await supabase.from('notifications').update({ is_read: true }).eq('id', item.id)
      setUnacked(prev => prev.filter((a: any) => a.id !== item.id))
    } else {
      await supabase.from('announcement_reads').insert({ announcement_id: item.id, user_id: profile!.id })
      setUnacked(prev => prev.filter((a: any) => a.id !== item.id))
      setAcked(prev => [item, ...prev])
    }
  }

  async function clearAllUnacked() {
    if (!unacked.length) return
    const notifItems = unacked.filter((i: any) => i.kind === 'notification' || i.kind === 'reminder')
    const annItems   = unacked.filter((i: any) => i.kind === 'announcement')
    await Promise.all([
      notifItems.length
        ? supabase.from('notifications').update({ is_read: true }).in('id', notifItems.map((i: any) => i.id))
        : Promise.resolve(),
      annItems.length
        ? supabase.from('announcement_reads').insert(annItems.map((i: any) => ({ announcement_id: i.id, user_id: profile!.id })))
        : Promise.resolve(),
    ])
    setUnacked([])
    setAcked((prev: any) => [...annItems, ...prev])
  }

  // ── Calendar computation — string-based move-in parsing avoids timezone bugs ──

  const moveIn = parseDateStr(tenant?.move_in_date)
  const moveInYear = moveIn?.year ?? 9999
  const moveInMonth = moveIn?.month ?? 99
  const minYear = moveIn?.year ?? now.getFullYear()

  const payByMonth: Record<string, any> = {}
  const elecPayByMonth: Record<string, any> = {}
  for (const p of payHistory) {
    const isElec = (p.notes ?? '').toLowerCase().startsWith('electricity')
    if (isElec) {
      const existing = elecPayByMonth[p.month_year]
      if (!existing || p.status === 'confirmed' || p.status === 'verified') elecPayByMonth[p.month_year] = p
    } else {
      const existing = payByMonth[p.month_year]
      if (!existing || p.status === 'confirmed' || p.status === 'verified') payByMonth[p.month_year] = p
    }
  }
  const elecByMonth: Record<string, number> = {}
  for (const e of elecHistory) { elecByMonth[e.month_year] = e.share_amount }

  const calendarCells = MONTH_NAMES.map((_, idx) => {
    const monthNum = idx + 1
    const mk = mKey(selectedYear, idx)
    // String-comparison-safe: before move-in
    const isBeforeMoveIn = selectedYear < moveInYear || (selectedYear === moveInYear && monthNum < moveInMonth)
    const isMoveIn = selectedYear === moveInYear && monthNum === moveInMonth
    const isFuture = !isBeforeMoveIn && !isMoveIn &&
      new Date(selectedYear, idx, 1) > new Date(now.getFullYear(), now.getMonth(), 1)

    const pay = isBeforeMoveIn ? undefined : payByMonth[mk]
    const elecAmt = isBeforeMoveIn ? null : (elecByMonth[mk] ?? null)

    let status = 'na'
    if (isBeforeMoveIn) status = 'na'
    else if (isMoveIn) status = 'move_in'
    else if (pay?.status === 'confirmed' || pay?.status === 'verified') status = 'paid'
    else if (pay?.status === 'pending') status = 'pending'
    else if (isFuture) status = 'future'
    else status = 'overdue'

    const BG: Record<string, string> = {
      na: 'rgba(0,0,0,0.03)', paid: 'rgba(52,199,89,0.11)', pending: 'rgba(255,149,0,0.11)',
      overdue: 'rgba(255,59,48,0.11)', future: 'rgba(0,0,0,0.03)', move_in: 'rgba(59,130,246,0.11)',
    }
    const TC: Record<string, string> = {
      na: '#AEAEB2', paid: '#15803d', pending: '#b45309',
      overdue: '#b91c1c', future: '#AEAEB2', move_in: '#1d4ed8',
    }
    const DC: Record<string, string> = {
      na: 'transparent', paid: '#34C759', pending: '#FF9500',
      overdue: '#FF3B30', future: 'transparent', move_in: '#3B82F6',
    }

    return { monthShort: MONTH_SHORT[idx], mk, status, isMoveIn, isBeforeMoveIn, isFuture, amount: pay?.amount ?? null, elecAmt, cellBg: BG[status], textColor: TC[status], dotColor: DC[status] }
  })

  // Electricity-only calendar — only shows months with posted bills
  const elecCalendarCells = MONTH_NAMES.map((_, idx) => {
    const monthNum = idx + 1
    const mk = mKey(selectedYear, idx)
    const isBeforeMoveIn = selectedYear < moveInYear || (selectedYear === moveInYear && monthNum < moveInMonth)
    const hasElecBill = !!elecByMonth[mk]
    const elecAmt = elecByMonth[mk] ?? null
    const elecPay = elecPayByMonth[mk]

    const isCurrentMK = mk === currentMK
    const isPastMK = mk < currentMK

    let status = 'na'
    if (isBeforeMoveIn || !hasElecBill) status = 'na'
    else if (elecPay?.status === 'confirmed' || elecPay?.status === 'verified') status = 'paid'
    else if (elecPay?.status === 'pending') status = 'pending'
    else if (isCurrentMK) status = 'active'   // bill exists, not yet paid, current month → yellow
    else if (isPastMK) status = 'overdue'     // bill exists, unpaid, past month → red
    else status = 'na'                         // future month with somehow a bill

    const BG: Record<string, string> = {
      na: 'rgba(0,0,0,0.03)', paid: 'rgba(52,199,89,0.11)', pending: 'rgba(255,149,0,0.11)',
      active: 'rgba(255,149,0,0.11)', overdue: 'rgba(255,59,48,0.11)',
    }
    const TC: Record<string, string> = {
      na: '#AEAEB2', paid: '#15803d', pending: '#b45309', active: '#b45309', overdue: '#b91c1c',
    }
    const DC: Record<string, string> = {
      na: 'transparent', paid: '#34C759', pending: '#FF9500', active: '#FF9500', overdue: '#FF3B30',
    }

    return {
      monthShort: MONTH_SHORT[idx], mk, status, isMoveIn: false, isBeforeMoveIn, isFuture: false,
      hasElecBill, elecAmt, amount: elecAmt, cellBg: BG[status], textColor: TC[status], dotColor: DC[status],
    }
  })

  // True total overdue count — iterates ALL months from move-in across all years,
  // independent of which calendar year is currently displayed.
  const totalOverdueMonths = (() => {
    if (!moveIn) return 0
    const confirmedKeys = new Set(
      payHistory
        .filter((p: any) => (p.status === 'confirmed' || p.status === 'verified') && !(p.notes ?? '').toLowerCase().startsWith('electricity'))
        .map((p: any) => p.month_year)
    )
    let count = 0
    // Start one month after move-in (move-in month is covered by deposit)
    const d = new Date(moveIn.year, moveIn.month - 1, 1)
    d.setMonth(d.getMonth() + 1)
    const currentMKStr = mKey(now.getFullYear(), now.getMonth())
    while (true) {
      const mk = mKey(d.getFullYear(), d.getMonth())
      if (mk > currentMKStr) break
      if (!confirmedKeys.has(mk)) count++
      d.setMonth(d.getMonth() + 1)
    }
    return count
  })()

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-5 max-w-2xl mx-auto lg:max-w-none animate-pulse">
        <div className="h-10 w-56 bg-white/40 rounded-xl" />
        <div className="h-40 bg-white/40 rounded-2xl" />
        <div className="h-12 bg-white/40 rounded-xl" />
        <div className="h-72 bg-white/40 rounded-2xl" />
        <div className="h-12 bg-white/40 rounded-2xl" />
        <div className="h-40 bg-white/40 rounded-2xl" />
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.3)' }}>
          <BedDouble size={28} className="text-[#AEAEB2]" />
        </div>
        <h2 className="text-[22px] font-semibold text-[#1D1D1F] mb-2">Not Assigned Yet</h2>
        <p className="text-[15px] text-[#6E6E73] max-w-xs leading-relaxed">
          Your landlord hasn't assigned you to a room yet. Check back soon.
        </p>
      </div>
    )
  }

  // Effective status: if ANY month from move-in is unpaid → always 'overdue'
  const overdueMonths = calendarCells.filter(c => c.status === 'overdue').length
  const effectiveStatus = totalOverdueMonths > 0 ? 'overdue' : (paymentStatus ?? 'due_soon')
  const sc = STATUS_CFG[effectiveStatus]
  const StatusIcon = sc.icon

  return (
    <div className="space-y-4 max-w-2xl mx-auto lg:max-w-none">

      {/* Header */}
      <div className="pt-1 flex items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-widest mb-1" style={{ color: '#6C5CE7' }}>
            Welcome back
          </p>
          <h1 className="text-[32px] font-bold tracking-tight leading-tight"
            style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #6C5CE7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {profile?.full_name?.split(' ')[0] ?? 'Renter'} 👋
          </h1>
          {buildingName && (
            <p className="text-[13px] text-[#6E6E73] mt-1">{buildingName}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0 pb-0.5">
          <p className="text-[11px] font-medium text-[#AEAEB2] leading-none">
            {now.toLocaleDateString('en-PH', { month: 'long' })}, {now.getFullYear()}
          </p>
          <p className="text-[44px] font-bold text-[#1D1D1F] leading-none tabular-nums my-0.5">
            {now.getDate()}
          </p>
          <p className="text-[13px] font-medium text-[#6E6E73] leading-none">
            {now.toLocaleDateString('en-PH', { weekday: 'long' })}
          </p>
        </div>
      </div>

      {/* Unacknowledged cards — announcements + reminders, priority-ordered */}
      {unacked.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[#AEAEB2]">Notifications</span>
            <button onClick={clearAllUnacked}
              className="text-[12px] font-medium text-[#AEAEB2] hover:text-[#6E6E73] transition-colors">
              Clear all
            </button>
          </div>
          {unacked.map((item: any) => {
            const priority = item.priority ?? 'regular'
            const cfg = ANN_PRIORITY[priority] ?? ANN_PRIORITY.regular
            const Icon = cfg.icon
            return (
              <div key={item.id}
                className="flex items-center gap-3 px-4 rounded-2xl cursor-pointer"
                onClick={() => setViewNotif(item)}
                style={{
                  height: 52,
                  background: cfg.bg,
                  border: `1px solid ${cfg.border}`,
                  borderLeft: `3px solid ${cfg.accent}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: cfg.badgeBg }}>
                  <Icon size={13} style={{ color: cfg.accent }} />
                </div>
                <div className="flex-1 min-w-0 overflow-hidden" style={{
                  maskImage: 'linear-gradient(to right, black 75%, transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to right, black 75%, transparent 100%)',
                }}>
                  <p className="text-[13px] leading-none whitespace-nowrap">
                    <span className="font-semibold text-[#1D1D1F]">{item.title}</span>
                    {item.message && <span className="text-[#6E6E73]"> · {item.message}</span>}
                  </p>
                </div>
                <span className="text-[10px] text-[#AEAEB2] flex-shrink-0 whitespace-nowrap">
                  {new Date(item.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); acknowledgeItem(item) }}
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.85)', color: cfg.accent, border: `1px solid ${cfg.border}` }}>
                  <CheckCircle2 size={12} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Balance card */}
      {(() => {
        // totalOverdueMonths covers ALL years from move-in, not just the displayed calendar year
        const totalOwed = totalOverdueMonths * (tenant.per_person_rent ?? 0)
        const hasOverdue = totalOverdueMonths > 0
        const elecPayStatus = (() => {
          if (!elecMonth) return 'none'
          const ep = payHistory.filter(p => p.month_year === elecMonth && (p.notes ?? '').toLowerCase().startsWith('electricity'))
          if (ep.some(p => p.status === 'confirmed' || p.status === 'verified')) return 'paid'
          if (ep.some(p => p.status === 'pending')) return 'pending'
          return 'unpaid'
        })()
        const elecStatusCfg: Record<string, { label: string; color: string; bg: string; border: string }> = {
          paid:   { label: 'Paid',    color: '#15803d', bg: 'rgba(52,199,89,0.1)',  border: 'rgba(52,199,89,0.25)' },
          pending:{ label: 'Pending', color: '#b45309', bg: 'rgba(255,149,0,0.1)', border: 'rgba(255,149,0,0.25)' },
          unpaid: { label: 'Unpaid',  color: '#b91c1c', bg: 'rgba(255,59,48,0.1)', border: 'rgba(255,59,48,0.25)' },
          none:   { label: '',        color: '#AEAEB2', bg: 'transparent',          border: 'transparent' },
        }
        const esc = elecStatusCfg[elecPayStatus]
        return (
          <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.55)', boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }}>
            {/* Amount + overdue banner */}
            <div className="flex items-start justify-between gap-2 mb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest mb-1"
                  style={{ color: hasOverdue ? '#dc2626' : '#6E6E73' }}>
                  {hasOverdue ? 'Total Outstanding' : 'Monthly Dues'}
                </p>
                <p className="text-[26px] sm:text-[38px] font-bold tabular-nums leading-none"
                  style={{ color: hasOverdue ? '#dc2626' : '#1D1D1F' }}>
                  {hasOverdue
                    ? fmtMoney(totalOwed)
                    : (tenant.per_person_rent > 0 ? fmtMoney(tenant.per_person_rent) : '—')}
                </p>
                {hasOverdue ? (
                  <p className="text-[12px] font-medium text-red-500 mt-1.5">
                    {totalOverdueMonths} unpaid month{totalOverdueMonths !== 1 ? 's' : ''}
                    {' · '}
                    {fmtMoney(tenant.per_person_rent)}/mo
                  </p>
                ) : (
                  <p className="text-[12px] text-[#6E6E73] mt-1.5">
                    {now.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
              {hasOverdue && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl flex-shrink-0"
                  style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)' }}>
                  <AlertTriangle size={12} className="text-red-500" />
                  <span className="text-[11px] font-bold text-red-600 whitespace-nowrap">
                    {totalOverdueMonths === 1 ? '1 month overdue' : `${totalOverdueMonths} months overdue`}
                  </span>
                </div>
              )}
            </div>
            {/* Rent row */}
            <div className="flex items-center justify-between py-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <div>
                <p className="text-[11px] font-medium text-[#6E6E73]">Rent</p>
                <p className="text-[13px] font-semibold text-[#1D1D1F] mt-0.5">
                  {now.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(255,255,255,0.7)', border: `1px solid ${sc.border.split('solid ')[1] ?? 'rgba(0,0,0,0.1)'}` }}>
                <StatusIcon size={11} style={{ color: sc.color }} />
                <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: sc.color }}>{sc.label}</span>
              </div>
            </div>
            {/* Electricity row */}
            {electricityShare != null && (
              <div className="flex items-center justify-between px-3 py-3 rounded-xl mt-2" style={{ background: 'rgba(255,149,0,0.07)', border: '1px solid rgba(255,149,0,0.15)' }}>
                <div className="flex items-center gap-1.5">
                  <Zap size={12} className="text-[#FF9500] flex-shrink-0" />
                  <div>
                    <p className="text-[11px] font-medium text-[#6E6E73]">Electricity</p>
                    <p className="text-[13px] font-semibold text-[#1D1D1F] mt-0.5">
                      {formatCurrency(electricityShare)}{elecMonth && <span className="font-normal text-[#6E6E73]"> · {fmtMY(elecMonth)}</span>}
                    </p>
                  </div>
                </div>
                {elecPayStatus !== 'none' && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{ background: esc.bg, border: `1px solid ${esc.border}` }}>
                    {elecPayStatus === 'paid'
                      ? <CheckCircle2 size={11} style={{ color: esc.color }} />
                      : elecPayStatus === 'pending'
                      ? <Clock size={11} style={{ color: esc.color }} />
                      : <AlertTriangle size={11} style={{ color: esc.color }} />}
                    <span className="text-[11px] font-bold" style={{ color: esc.color }}>{esc.label}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* Pay Rent CTA */}
      <button
        onClick={() => { setUploadPresetType('rent'); setUploadPresetMonth(currentMK); setShowUploadModal(true) }}
        className="w-full flex items-center justify-center gap-2.5 h-12 text-white rounded-xl font-semibold text-[15px] transition-all active:scale-95"
        style={{ background: '#0071E3', boxShadow: '0 4px 14px rgba(0,113,227,0.3)' }}>
        <CreditCard size={17} />
        Pay Rent
      </button>

      {/* Payment Calendar */}
      <div className="rounded-2xl overflow-hidden" style={GLASS}>
        <div className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.06)' }}>
            <button onClick={() => setCalendarTab('rent')}
              className="px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all"
              style={calendarTab === 'rent'
                ? { background: '#fff', color: '#1D1D1F', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                : { color: '#6E6E73' }}>
              Rent
            </button>
            <button onClick={() => setCalendarTab('electricity')}
              className="px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all"
              style={calendarTab === 'electricity'
                ? { background: '#fff', color: '#1D1D1F', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                : { color: '#6E6E73' }}>
              Electricity
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setSelectedYear(y => y - 1)} disabled={selectedYear <= minYear}
              className="w-7 h-7 flex items-center justify-center rounded-lg disabled:opacity-30 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.06)' }}>
              <ChevronLeft size={14} className="text-slate-500" />
            </button>
            <span className="text-[14px] font-semibold text-[#1D1D1F] min-w-[44px] text-center tabular-nums">{selectedYear}</span>
            <button onClick={() => setSelectedYear(y => y + 1)}
              disabled={selectedYear >= (calendarTab === 'rent' ? now.getFullYear() + 1 : now.getFullYear())}
              className="w-7 h-7 flex items-center justify-center rounded-lg disabled:opacity-30 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.06)' }}>
              <ChevronRight size={14} className="text-slate-500" />
            </button>
          </div>
        </div>

        <div className="p-4 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {(calendarTab === 'rent' ? calendarCells : elecCalendarCells).map((cell) => {
            const { monthShort, mk, isMoveIn, isBeforeMoveIn, hasElecBill, amount, elecAmt, cellBg, textColor, dotColor } = cell as any
            const isDisabled = isBeforeMoveIn || (calendarTab === 'electricity' && !hasElecBill)
            return (
              <button key={mk}
                onClick={() => !isDisabled && setSelectedCell({ ...cell, focusType: calendarTab })}
                disabled={isDisabled}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-all active:scale-95 disabled:cursor-default hover:brightness-95"
                style={{
                  background: cellBg,
                  border: isMoveIn ? '1.5px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.35)',
                  minHeight: 96,
                  opacity: isDisabled ? 0.2 : 1,
                }}>
                <span className="text-[13px] font-bold text-[#1D1D1F] leading-none">{monthShort}</span>
                {isMoveIn && <span className="text-[8px] font-bold uppercase tracking-wide text-blue-500 leading-none">move-in</span>}
                {dotColor !== 'transparent' && !isDisabled && (
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: dotColor }} />
                )}
                {amount != null && !isDisabled && (
                  <span className="text-[10px] font-semibold tabular-nums leading-tight" style={{ color: textColor }}>
                    {formatCurrency(amount)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Roommate strip */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl" style={GLASS}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(108,92,231,0.12)' }}>
          <BedDouble size={15} className="text-[#6C5CE7]" />
        </div>
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-2">
          <span className="text-[14px] font-semibold text-[#1D1D1F]">
            {tenant.room?.room_number ? `Room ${tenant.room.room_number}` : 'Your Room'}
          </span>
          {roommates.length > 0
            ? <span className="text-[13px] text-[#6E6E73]">· With: {roommates.join(', ')}</span>
            : <span className="text-[13px] text-[#6E6E73]">· Solo room</span>}
        </div>
      </div>

      {/* Announcements — acknowledged history */}
      <div className="rounded-2xl overflow-hidden" style={GLASS}>
        <div className="px-5 py-4 flex items-center gap-2.5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
          <Megaphone size={15} className="text-[#0071E3]" />
          <h2 className="text-[15px] font-semibold text-[#1D1D1F]">Announcements</h2>
        </div>
        {acked.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-[14px] font-medium text-[#1D1D1F]">No announcements yet</p>
            <p className="text-[12px] text-[#6E6E73] mt-1">Your landlord hasn't posted anything.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.35)' }}>
            {acked.map((a: any) => {
              const priority = a.priority ?? 'regular'
              const cfg = ANN_PRIORITY[priority] ?? ANN_PRIORITY.regular
              const Icon = cfg.icon
              return (
                <div key={a.id} className="px-5 py-4 flex items-start gap-3 transition-all active:bg-black/5"
                  onClick={() => setViewNotif({ ...a, kind: 'announcement' })}
                  style={{ borderLeft: `3px solid ${cfg.accent}`, cursor: 'pointer' }}>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: cfg.badgeBg }}>
                    <Icon size={12} style={{ color: cfg.accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: cfg.accent }}>{cfg.label}</span>
                      <span className="text-[11px] text-[#AEAEB2]">· {timeAgo(a.created_at)}</span>
                    </div>
                    <p className="text-[14px] font-semibold text-[#1D1D1F] leading-snug">{a.title}</p>
                    <p className="text-[13px] text-[#6E6E73] mt-1 leading-relaxed line-clamp-2">{a.message}</p>
                    {a.photo_url && <p className="text-[11px] mt-1" style={{ color: cfg.accent }}>📷 Photo attached · tap to view</p>}
                  </div>
                  <ChevronRight size={14} className="text-[#AEAEB2] flex-shrink-0 mt-0.5" />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Month Detail Modal */}
      {selectedCell && (
        <MonthDetailModal
          cell={selectedCell}
          payHistory={payHistory}
          elecHistory={elecHistory}
          tenant={tenant}
          buildingName={buildingName}
          buildingAddress={buildingAddress}
          landlordName={profile?.full_name ?? ''}
          onClose={() => setSelectedCell(null)}
          onUpload={(type, mk) => {
            setSelectedCell(null)
            setUploadPresetType(type)
            setUploadPresetMonth(mk)
            setShowUploadModal(true)
          }}
        />
      )}

      {/* Pay / Upload Modal */}
      {showUploadModal && (
        <UploadModal
          tenant={tenant}
          payHistory={payHistory}
          elecHistory={elecHistory}
          initialType={uploadPresetType}
          initialMonth={uploadPresetMonth}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false)
            init()
          }}
        />
      )}

      {/* Notification / Announcement Detail Popup */}
      {viewNotif && (() => {
        const priority = viewNotif.priority ?? 'regular'
        const cfg = ANN_PRIORITY[priority] ?? ANN_PRIORITY.regular
        const Icon = cfg.icon
        const isUnacked = unacked.some((u: any) => u.id === viewNotif.id)
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setViewNotif(null)} />
            <div className="relative w-full max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[88vh] flex flex-col"
              style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 -4px 40px rgba(0,0,0,0.2)' }}>
              <div className="w-10 h-1 rounded-full mx-auto mt-3 sm:hidden" style={{ background: 'rgba(0,0,0,0.12)' }} />
              <div className="h-1 w-full" style={{ background: cfg.accent }} />
              <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
                style={{ background: cfg.bg, borderBottom: `1px solid ${cfg.border}` }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: cfg.badgeBg }}>
                    <Icon size={15} style={{ color: cfg.accent }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cfg.accent }}>{cfg.label}</p>
                    <p className="text-[11px] text-[#AEAEB2]">{timeAgo(viewNotif.created_at)}</p>
                  </div>
                </div>
                <button onClick={() => setViewNotif(null)} className="p-2 rounded-xl"
                  style={{ background: 'rgba(0,0,0,0.06)' }}><X size={15} className="text-slate-400" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                <h2 className="text-[18px] font-bold text-[#1D1D1F] leading-snug">{viewNotif.title}</h2>
                <p className="text-[15px] text-[#6E6E73] leading-relaxed whitespace-pre-wrap">{viewNotif.message}</p>
                {viewNotif.photo_url && (
                  <img src={viewNotif.photo_url} alt="" className="w-full rounded-xl object-cover"
                    loading="lazy" decoding="async" style={{ maxHeight: 280 }} />
                )}
              </div>
              {isUnacked && (
                <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                  <button onClick={() => { acknowledgeItem(viewNotif); setViewNotif(null) }}
                    className="w-full h-11 rounded-xl font-semibold text-[14px] flex items-center justify-center gap-2"
                    style={{ background: cfg.badgeBg, color: cfg.accent, border: `1px solid ${cfg.border}` }}>
                    <CheckCircle2 size={15} />
                    {viewNotif.kind === 'announcement' ? 'Acknowledge' : 'Dismiss'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
