// @ts-nocheck
import { useEffect, useState } from 'react'
import {
  ChevronLeft, ChevronRight, Download, TrendingUp, TrendingDown, Minus,
  Banknote, AlertTriangle, Zap, BarChart2, CreditCard, DoorOpen,
  CheckCircle2, Users, Clock, X, Search,
} from 'lucide-react'
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency, fmtMoney, formatDate } from '@/lib/utils'

const GLASS = {
  background: 'rgba(255,255,255,0.22)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.45)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(108,92,231,0.06), 0 1px 1px rgba(255,255,255,0.5) inset',
}

const SOLO_DISCOUNT = 500
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function monthKey(y: number, m: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}`
}
function fmtMY(mk: string) {
  const [y, mo] = mk.split('-')
  return `${MONTH_NAMES[parseInt(mo) - 1]} ${y}`
}
function perPerson(rent: number, occ: number) {
  return occ <= 1 ? rent - SOLO_DISCOUNT : rent / occ
}
function getLast6(refYear: number, refMonth: number) {
  const arr: { key: string; label: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(refYear, refMonth - i, 1)
    arr.push({
      key: monthKey(d.getFullYear(), d.getMonth()),
      label: `${MONTH_SHORT[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`,
    })
  }
  return arr
}

const REPORT_TYPES = [
  { id: 'financial',   label: 'Financial Summary', icon: BarChart2,     desc: 'Rent, collection & income overview' },
  { id: 'electricity', label: 'Electricity',        icon: Zap,           desc: 'Electricity payment history' },
  { id: 'overdue',     label: 'Overdue',            icon: AlertTriangle, desc: 'Renters with unpaid balances' },
  { id: 'payments',    label: 'Rent Payments',      icon: CreditCard,    desc: 'Rent payment records' },
  { id: 'occupancy',   label: 'Occupancy',          icon: DoorOpen,      desc: 'Room occupancy breakdown' },
]

/* ── MonthPicker ── */
function MonthPicker({ year, month, onChange }: {
  year: number; month: number; onChange: (y: number, m: number) => void
}) {
  const now = new Date()
  const isMax = year === now.getFullYear() && month === now.getMonth()
  function prev() { if (month === 0) onChange(year - 1, 11); else onChange(year, month - 1) }
  function next() { if (isMax) return; if (month === 11) onChange(year + 1, 0); else onChange(year, month + 1) }
  return (
    <div className="flex items-center gap-2">
      <button onClick={prev}
        className="w-9 h-9 rounded-xl flex items-center justify-center transition-all text-slate-400 hover:text-[#6C5CE7]"
        style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.7)' }}>
        <ChevronLeft size={16} />
      </button>
      <div className="min-w-[140px] text-center px-4 py-2.5 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.7)' }}>
        <p className="text-[15px] font-bold text-[#1e1b4b] leading-tight">{MONTH_NAMES[month]}</p>
        <p className="text-[12px] text-slate-400 font-medium">{year}</p>
      </div>
      <button onClick={next} disabled={isMax}
        className="w-9 h-9 rounded-xl flex items-center justify-center transition-all text-slate-400 hover:text-[#6C5CE7] disabled:opacity-30"
        style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.7)' }}>
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

/* ── StatCard ── */
function StatCard({ label, value, sub, valueColor = '#1e1b4b', icon: Icon, iconBg, iconColor }: any) {
  return (
    <div style={GLASS} className="p-4 sm:p-5">
      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center mb-2.5 sm:mb-3"
        style={{ background: iconBg, border: '1px solid rgba(255,255,255,0.5)' }}>
        <Icon size={15} className={iconColor} />
      </div>
      <p className="text-[18px] sm:text-[22px] font-bold tabular-nums leading-tight" style={{ color: valueColor }}>{value}</p>
      <p className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wide text-slate-400 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] sm:text-[12px] text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

/* ── ChartTooltip ── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="px-4 py-3 rounded-xl shadow-lg"
      style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.08)', minWidth: 160 }}>
      <p className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wide">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4 text-[13px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
            <span className="text-slate-500">{p.name}</span>
          </span>
          <span className="font-bold text-[#1e1b4b] tabular-nums">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

/* ── ReportTable ── */
function ReportTable({ columns, rows, emptyText = 'No data for this period.' }: {
  columns: { key: string; label: string; align?: 'left' | 'right'; bold?: boolean; render?: (val: any, row: any) => any }[]
  rows: any[]
  emptyText?: string
}) {
  if (rows.length === 0) {
    return (
      <div className="py-14 text-center">
        <CheckCircle2 size={28} className="text-slate-300 mx-auto mb-3" />
        <p className="text-[14px] text-slate-400">{emptyText}</p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
            {columns.map(c => (
              <th key={c.key}
                className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400 whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}
              style={{ borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.25)' : undefined }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}>
              {columns.map(c => (
                <td key={c.key}
                  className={`px-5 py-3 text-[13px] whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''} ${c.bold ? 'font-semibold text-[#1e1b4b]' : 'text-[#374151]'}`}>
                  {c.render ? c.render(row[c.key], row) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── StatusBadge ── */
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    paid:        { bg: 'rgba(22,163,74,0.12)',   color: '#16a34a', label: '✓ Paid' },
    partial:     { bg: 'rgba(245,158,11,0.12)',  color: '#d97706', label: 'Partial' },
    unpaid:      { bg: 'rgba(239,68,68,0.12)',   color: '#dc2626', label: 'Unpaid' },
    occupied:    { bg: 'rgba(108,92,231,0.12)',  color: '#6C5CE7', label: 'Occupied' },
    vacant:      { bg: 'rgba(100,116,139,0.12)', color: '#64748b', label: 'Vacant' },
    maintenance: { bg: 'rgba(245,158,11,0.12)',  color: '#d97706', label: 'Maintenance' },
  }
  const s = styles[status] ?? { bg: 'rgba(0,0,0,0.06)', color: '#64748b', label: status }
  return (
    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

/* ── OverdueBadge ── */
function OverdueBadge({ months }: { months: number }) {
  const style = months >= 3
    ? { bg: 'rgba(239,68,68,0.12)', color: '#dc2626' }
    : months >= 2
    ? { bg: 'rgba(249,115,22,0.12)', color: '#ea580c' }
    : { bg: 'rgba(245,158,11,0.12)', color: '#d97706' }
  return (
    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold"
      style={{ background: style.bg, color: style.color }}>
      {months} month{months !== 1 ? 's' : ''}
    </span>
  )
}

/* ── Excel Range Modal ── */
function ExcelModal({ onClose, onGenerate }: {
  onClose: () => void
  onGenerate: (fromMK: string, toMK: string) => void
}) {
  const now = new Date()
  const threeAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
  const [fromYear, setFromYear] = useState(threeAgo.getFullYear())
  const [fromMonth, setFromMonth] = useState(threeAgo.getMonth())
  const [toYear, setToYear] = useState(now.getFullYear())
  const [toMonth, setToMonth] = useState(now.getMonth())
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.08)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[17px] font-bold text-[#1e1b4b]">Export Excel Report</p>
            <p className="text-[13px] text-slate-400 mt-0.5">Select the date range to include</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600"
            style={{ background: 'rgba(0,0,0,0.05)' }}>
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 justify-center flex-wrap">
            <MonthPicker year={fromYear} month={fromMonth}
              onChange={(y, m) => { setFromYear(y); setFromMonth(m) }} />
            <span className="text-[20px] text-slate-300 font-light px-1">→</span>
            <MonthPicker year={toYear} month={toMonth}
              onChange={(y, m) => { setToYear(y); setToMonth(m) }} />
          </div>
          <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl"
            style={{ background: 'rgba(108,92,231,0.06)', border: '1px solid rgba(108,92,231,0.12)' }}>
            <span className="text-[13px] font-medium text-[#6C5CE7]">
              {fmtMY(monthKey(fromYear, fromMonth))} → {fmtMY(monthKey(toYear, toMonth))}
            </span>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 h-11 rounded-xl text-[14px] font-medium text-slate-500"
            style={{ background: 'rgba(0,0,0,0.05)' }}>
            Cancel
          </button>
          <button
            onClick={() => onGenerate(monthKey(fromYear, fromMonth), monthKey(toYear, toMonth))}
            className="flex-1 h-11 rounded-xl text-[14px] font-semibold text-white flex items-center justify-center gap-2"
            style={{ background: '#6C5CE7', boxShadow: '0 4px 12px rgba(108,92,231,0.3)' }}>
            <Download size={15} /> Generate File
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main Component ── */
export default function Reports() {
  const { profile } = useAuth()
  const now = new Date()
  const threeAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)

  const [activeType, setActiveType] = useState('financial')
  const [selYear, setSelYear] = useState(now.getFullYear())
  const [selMonth, setSelMonth] = useState(now.getMonth())
  const [fromYear, setFromYear] = useState(threeAgo.getFullYear())
  const [fromMonth, setFromMonth] = useState(threeAgo.getMonth())
  const [toYear, setToYear] = useState(now.getFullYear())
  const [toMonth, setToMonth] = useState(now.getMonth())
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<any>(null)
  const [buildingIds, setBuildingIds] = useState<string[]>([])
  const [boardingHouseName, setBoardingHouseName] = useState('')
  const [showExcelModal, setShowExcelModal] = useState(false)
  const [paymentSearch, setPaymentSearch] = useState('')
  const [elecSearch, setElecSearch] = useState('')

  useEffect(() => {
    supabase.from('buildings').select('id, name').eq('landlord_id', profile!.id)
      .then(({ data }) => {
        setBuildingIds((data ?? []).map((b: any) => b.id))
        setBoardingHouseName((data ?? [])[0]?.name ?? '')
      })
  }, [])

  useEffect(() => {
    if (!buildingIds.length) return
    loadReport()
  }, [activeType, selYear, selMonth, fromYear, fromMonth, toYear, toMonth, buildingIds])

  // Realtime: silently refresh whenever source tables change
  useEffect(() => {
    if (!buildingIds.length) return
    const ch = supabase.channel('reports-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' },       () => loadReport(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' },          () => loadReport(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tenants' },        () => loadReport(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'electricity_bills' }, () => loadReport(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'electricity_shares' }, () => loadReport(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' },       () => loadReport(true))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [buildingIds, activeType, selYear, selMonth, fromYear, fromMonth, toYear, toMonth])

  async function getRooms() {
    const { data } = await supabase.from('rooms')
      .select('id, room_number, floor_number, rent_amount, status')
      .in('building_id', buildingIds)
    return data ?? []
  }

  async function getTenants(roomIds: string[]) {
    const { data } = await supabase.from('tenants')
      .select('id, name, occupants, room_id, move_in_date, room:rooms(id, room_number, floor_number, rent_amount)')
      .eq('is_active', true)
      .not('room_id', 'is', null)
      .in('room_id', roomIds)
    return data ?? []
  }

  async function loadReport(silent = false) {
    if (!silent) { setLoading(true); setReportData(null) }
    try {
      if (activeType === 'financial')        await loadFinancial()
      else if (activeType === 'electricity') await loadElectricity()
      else if (activeType === 'overdue')     await loadOverdue()
      else if (activeType === 'payments')    await loadPayments()
      else if (activeType === 'occupancy')   await loadOccupancy()
    } finally {
      if (!silent) setLoading(false)
    }
  }

  /* ── Financial Summary ── */
  async function loadFinancial() {
    const rooms = await getRooms()
    const roomIds = rooms.map((r: any) => r.id)
    const tenants = await getTenants(roomIds)
    const mk = monthKey(selYear, selMonth)
    const months = getLast6(selYear, selMonth)

    const roomOccMap = new Map<string, number>()
    for (const t of tenants) {
      if (t.room_id) roomOccMap.set(t.room_id, (roomOccMap.get(t.room_id) ?? 0) + ((t as any).occupants ?? 1))
    }
    const projectedRent = tenants.reduce(
      (s: number, t: any) => s + perPerson(t.room?.rent_amount ?? 0, t.room_id ? (roomOccMap.get(t.room_id) ?? 1) : 1), 0
    )

    const prevDate = new Date(selYear, selMonth - 1, 1)
    const prevMK = monthKey(prevDate.getFullYear(), prevDate.getMonth())
    const monthKeys6 = months.map(m => m.key)

    // Date-based ranges so payments count in the month they were actually made
    const pad = (n: number) => String(n).padStart(2, '0')
    const curStart  = `${selYear}-${pad(selMonth + 1)}-01`
    const curEnd    = (() => { const d = new Date(selYear, selMonth + 1, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01` })()
    const prevStart = `${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}-01`
    const sixStart  = months[0].key + '-01'  // first day of earliest month in range

    const [
      { data: curPayments },
      { data: allPayments },
      { data: prevAllPays },
    ] = await Promise.all([
      // Rent payments physically received in the selected month (by payment_date)
      supabase.from('payments')
        .select('tenant_id, amount, notes')
        .in('room_id', roomIds)
        .gte('payment_date', curStart)
        .lt('payment_date', curEnd)
        .in('status', ['confirmed', 'verified']),
      // Rent payments received in the last 6 months — group by payment month in JS
      supabase.from('payments')
        .select('amount, payment_date, notes')
        .in('room_id', roomIds)
        .in('status', ['confirmed', 'verified'])
        .gte('payment_date', sixStart)
        .lt('payment_date', curEnd),
      // Rent payments received last month (for vs-last-month comparison)
      supabase.from('payments')
        .select('amount, notes')
        .in('room_id', roomIds)
        .gte('payment_date', prevStart)
        .lt('payment_date', curStart)
        .in('status', ['confirmed', 'verified']),
    ])

    // Count by tenant — rent only, received this month
    const paidMap = new Map<string, number>()
    for (const p of (curPayments ?? []).filter((p: any) => !(p.notes ?? '').toLowerCase().startsWith('electricity'))) {
      paidMap.set(p.tenant_id, (paidMap.get(p.tenant_id) ?? 0) + p.amount)
    }
    let collected = 0; let paidCount = 0; let unpaidCount = 0
    for (const t of tenants) {
      const rent = perPerson(t.room?.rent_amount ?? 0, t.room_id ? (roomOccMap.get(t.room_id) ?? 1) : 1)
      const paid = paidMap.get(t.id) ?? 0
      collected += paid
      if (paid >= rent * 0.99) paidCount++; else unpaidCount++
    }

    const remaining = Math.max(0, projectedRent - collected)
    const collectPct = projectedRent > 0 ? Math.min(100, (collected / projectedRent) * 100) : 0

    const prevTotal = (prevAllPays ?? [])
      .filter((p: any) => !(p.notes ?? '').toLowerCase().startsWith('electricity'))
      .reduce((s: number, p: any) => s + p.amount, 0)
    const vsLastMonth = prevTotal > 0 ? ((collected - prevTotal) / prevTotal) * 100 : null

    // Group rent income by the month the payment was actually made (payment_date)
    const incomeByMonth: Record<string, number> = {}
    for (const p of (allPayments ?? []).filter((p: any) => !(p.notes ?? '').toLowerCase().startsWith('electricity'))) {
      if (!p.payment_date) continue
      const pmk = (p.payment_date as string).slice(0, 7) // 'YYYY-MM'
      incomeByMonth[pmk] = (incomeByMonth[pmk] ?? 0) + p.amount
    }
    const trendChart = months.map(m => ({
      month: m.label,
      Income: Math.round(incomeByMonth[m.key] ?? 0),
    }))
    const overdueChart = months.map(m => ({
      month: m.label,
      Uncollected: Math.max(0, Math.round(projectedRent - (incomeByMonth[m.key] ?? 0))),
    }))

    const totalRent6   = Object.values(incomeByMonth).reduce((s, v) => s + v, 0)
    const avgMonthly6  = Math.round(totalRent6 / 6)
    const bestMonth    = months.reduce((best, m) => (incomeByMonth[m.key] ?? 0) > (incomeByMonth[best.key] ?? 0) ? m : best, months[0])

    setReportData({
      type: 'financial',
      projectedRent,
      collected, remaining, collectPct,
      paidCount, unpaidCount, totalCount: tenants.length,
      vsLastMonth, prevMK,
      trendChart, overdueChart,
      totalRent6, avgMonthly6, bestMonth: bestMonth.label,
    })
  }

  /* ── Electricity Payment History ── */
  async function loadElectricity() {
    setElecSearch('')
    const rooms = await getRooms()
    const roomIds = rooms.map((r: any) => r.id)
    if (!roomIds.length) {
      setReportData({ type: 'electricity', total: 0, count: 0, rows: [] })
      return
    }
    const fromMK = monthKey(fromYear, fromMonth)
    const toMK   = monthKey(toYear, toMonth)
    const { data } = await supabase.from('payments')
      .select('id, amount, month_year, payment_date, created_at, payment_method, tenant:tenants(name), room:rooms(room_number)')
      .in('room_id', roomIds)
      .in('status', ['confirmed', 'verified'])
      .ilike('notes', 'Electricity%')
      .gte('month_year', fromMK)
      .lte('month_year', toMK)
      .order('created_at', { ascending: false })
    const methodMap: Record<string, string> = { cash: 'Cash', gcash: 'GCash', bank_transfer: 'Bank Transfer', other: 'Other' }
    const rows = (data ?? []).map((p: any) => {
      const ts = p.created_at ? new Date(p.created_at) : null
      return {
        reference: p.reference_number ?? `ELEC-${p.id.slice(0, 5).toUpperCase()}`,
        date: p.payment_date ? formatDate(p.payment_date) : '—',
        time: ts ? ts.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—',
        datetime: ts
          ? ts.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + ts.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
          : '—',
        renter: p.tenant?.name ?? '—',
        room: p.room?.room_number ? `Room ${p.room.room_number}` : '—',
        type: 'Electricity',
        amount: p.amount,
        method: methodMap[p.payment_method ?? ''] ?? (p.payment_method ?? '—'),
        month: fmtMY(p.month_year),
      }
    })
    setReportData({ type: 'electricity', total: rows.reduce((s, r) => s + r.amount, 0), count: rows.length, rows })
  }

  /* ── Overdue Report ── */
  async function loadOverdue() {
    const rooms = await getRooms()
    const roomIds = rooms.map((r: any) => r.id)
    const tenants = await getTenants(roomIds)
    const tenantIds = tenants.map((t: any) => t.id)
    const [{ data: confirmedPays }, { data: pendingPays }] = await Promise.all([
      supabase.from('payments').select('tenant_id, month_year').in('tenant_id', tenantIds).in('status', ['confirmed', 'verified']),
      supabase.from('payments').select('tenant_id, month_year').in('tenant_id', tenantIds).eq('status', 'pending'),
    ])
    // Pending submissions block overdue — the tenant is trying to pay
    const paidSet = new Set([
      ...(confirmedPays ?? []).map((p: any) => `${p.tenant_id}|${p.month_year}`),
      ...(pendingPays ?? []).map((p: any) => `${p.tenant_id}|${p.month_year}`),
    ])
    // Build room-level occupant totals for correct per-person rent
    const roomOccMapOvd = new Map<string, number>()
    for (const t of tenants) {
      if (t.room_id) roomOccMapOvd.set(t.room_id, (roomOccMapOvd.get(t.room_id) ?? 0) + ((t as any).occupants ?? 1))
    }
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const rows: any[] = []
    for (const t of tenants) {
      if (!t.move_in_date) continue
      const roomOcc = t.room_id ? (roomOccMapOvd.get(t.room_id) ?? 1) : 1
      const rent = perPerson(t.room?.rent_amount ?? 0, roomOcc)
      let months = 0
      const d = new Date((t as any).move_in_date + 'T00:00:00')
      const cur = new Date(d.getFullYear(), d.getMonth(), 1)
      while (cur <= lastMonth) {
        if (!paidSet.has(`${t.id}|${monthKey(cur.getFullYear(), cur.getMonth())}`)) months++
        cur.setMonth(cur.getMonth() + 1)
      }
      if (months > 0) rows.push({
        name: (t as any).name,
        room_number: (t as any).room?.room_number ?? '—',
        move_in_date: (t as any).move_in_date,
        months_overdue: months,
        monthly_rent: rent,
        total_due: months * rent,
      })
    }
    rows.sort((a, b) => b.total_due - a.total_due || b.months_overdue - a.months_overdue)
    rows.forEach((r, i) => { r.rank = i + 1 })
    setReportData({
      type: 'overdue', totalRenters: rows.length,
      totalAmount: rows.reduce((s, r) => s + r.total_due, 0), rows,
    })
  }

  /* ── Payment History ── */
  async function loadPayments() {
    const rooms = await getRooms()
    const roomIds = rooms.map((r: any) => r.id)
    const fromMK = monthKey(fromYear, fromMonth)
    const toMK = monthKey(toYear, toMonth)
    const { data } = await supabase.from('payments')
      .select('id, amount, month_year, payment_date, created_at, payment_method, reference_number, notes, tenant:tenants(name), room:rooms(room_number)')
      .in('room_id', roomIds).in('status', ['confirmed', 'verified'])
      .gte('month_year', fromMK).lte('month_year', toMK)
      .order('created_at', { ascending: false })
    const methodMap: Record<string, string> = { cash: 'Cash', gcash: 'GCash', bank_transfer: 'Bank Transfer', other: 'Other' }
    const rows = (data ?? [])
      .filter((p: any) => !(p.notes ?? '').toLowerCase().startsWith('electricity'))
      .map((p: any) => {
        const ts = p.created_at ? new Date(p.created_at) : null
        return {
          reference: p.reference_number ?? '—',
          date: p.payment_date ? formatDate(p.payment_date) : '—',
          time: ts ? ts.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—',
          datetime: ts ? ts.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + ts.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '—',
          renter: p.tenant?.name ?? '—',
          room: p.room?.room_number ? `Room ${p.room.room_number}` : '—',
          type: 'Rent',
          amount: p.amount,
          method: methodMap[p.payment_method ?? ''] ?? (p.payment_method ?? '—'),
          month: fmtMY(p.month_year),
        }
      })
    setPaymentSearch('')
    setReportData({ type: 'payments', total: rows.reduce((s, r) => s + r.amount, 0), count: rows.length, rows })
  }

  /* ── Occupancy Report ── */
  async function loadOccupancy() {
    const { data: rooms } = await supabase.from('rooms')
      .select('id, room_number, floor_number, rent_amount, status, tenants(id, name, occupants, is_active)')
      .in('building_id', buildingIds).order('room_number')
    const rows = (rooms ?? []).map((r: any) => {
      const activeTenants = (r.tenants ?? []).filter((t: any) => t.is_active)
      const totalOccupants = activeTenants.reduce((s: number, t: any) => s + (t.occupants ?? 1), 0)
      const firstName = activeTenants[0]?.name ?? null
      const tenantLabel = activeTenants.length > 1
        ? `${firstName} +${activeTenants.length - 1}`
        : firstName
      return {
        room_number: r.room_number, floor: r.floor_number ? `${r.floor_number}F` : '—',
        tenant_name: tenantLabel, status: r.status,
        rent_amount: r.rent_amount, occupants: activeTenants.length > 0 ? totalOccupants : null,
      }
    })
    const occupied = rows.filter(r => r.status === 'occupied').length
    const vacant = rows.filter(r => r.status === 'vacant').length
    const maintenance = rows.filter(r => r.status === 'maintenance').length
    setReportData({
      type: 'occupancy', total: rows.length, occupied, vacant, maintenance,
      occupancyRate: rows.length > 0 ? (occupied / rows.length) * 100 : 0, rows,
    })
  }

  /* ── Excel Export ── */
  function doExport(fromMK: string, toMK: string) {
    setShowExcelModal(false)
    if (!reportData) return
    const d = reportData
    const typeDef = REPORT_TYPES.find(r => r.id === activeType)
    const reportTitle = `ATIMAN — ${typeDef?.label ?? 'Report'}`
    const dateLabel = `${fmtMY(fromMK)} → ${fmtMY(toMK)}`

    let headers: string[] = []
    let dataRows: any[][] = []
    let totalsRow: any[] | null = null

    if (activeType === 'financial') {
      headers = ['Month', 'Projected (PHP)', 'Collected (PHP)', 'Collection Rate (%)']
      dataRows = (d.collectionChart ?? []).map((r: any) => [
        r.month, d.projected, r.Collected,
        d.projected > 0 ? parseFloat(((r.Collected / d.projected) * 100).toFixed(1)) : 0,
      ])
    } else if (activeType === 'electricity') {
      headers = ['Reference #', 'Date', 'Time', 'Renter', 'Room', 'Type', 'Amount (PHP)', 'Method', 'Period']
      dataRows = d.rows.map((r: any) => [r.reference, r.date, r.time, r.renter, r.room, r.type, r.amount, r.method, r.month])
      totalsRow = ['TOTAL', '', '', '', '', '', d.total, '', '']
    } else if (activeType === 'overdue') {
      headers = ['Rank', 'Renter', 'Room', 'Move-in Date', 'Months Overdue', 'Monthly Rent (PHP)', 'Total Due (PHP)']
      dataRows = d.rows.map((r: any) => [r.rank, r.name, `Room ${r.room_number}`, r.move_in_date, r.months_overdue, r.monthly_rent, r.total_due])
      totalsRow = ['', 'TOTAL OVERDUE', '', '', '', '', d.totalAmount]
    } else if (activeType === 'payments') {
      headers = ['Reference #', 'Date', 'Time', 'Renter', 'Room', 'Type', 'Amount (PHP)', 'Method', 'Period']
      dataRows = d.rows.map((r: any) => [r.reference, r.date, r.time, r.renter, r.room, r.type, r.amount, r.method, r.month])
      totalsRow = ['TOTAL', '', '', '', '', '', d.total, '', '']
    } else if (activeType === 'occupancy') {
      headers = ['Room', 'Floor', 'Tenant', 'Status', 'Rent Amount (PHP)', 'Occupants']
      dataRows = d.rows.map((r: any) => [`Room ${r.room_number}`, r.floor, r.tenant_name ?? 'Vacant', r.status, r.rent_amount, r.occupants ?? '—'])
    }

    const sheetData: any[][] = [
      [reportTitle],
      [`Period: ${dateLabel}   |   Generated: ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`],
      [`Boarding House: ${boardingHouseName || (profile?.full_name ?? '—')}`],
      [],
      headers,
      ...dataRows,
    ]
    if (totalsRow) { sheetData.push([]); sheetData.push(totalsRow) }

    const ws = XLSX.utils.aoa_to_sheet(sheetData)
    ws['!cols'] = headers.map(() => ({ wch: 22 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Report')
    XLSX.writeFile(wb, `ATIMAN_${(typeDef?.label ?? 'Report').replace(/\s+/g, '_')}_${dateLabel.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`)
  }

  const isSingleMonth = activeType === 'financial'
  const isRange = activeType === 'payments' || activeType === 'electricity'
  const isCurrentStatus = activeType === 'overdue' || activeType === 'occupancy'

  return (
    <div className="space-y-5">

      {showExcelModal && (
        <ExcelModal onClose={() => setShowExcelModal(false)} onGenerate={doExport} />
      )}

      {/* Header */}
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1e1b4b]">Reports</h1>
        <p className="text-[15px] text-slate-400 mt-0.5">
          {boardingHouseName ? `${boardingHouseName} · ` : ''}Analytics &amp; financial overview
        </p>
      </div>

      {/* Controls */}
      <div style={GLASS} className="p-5">

        {/* Report type pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{ scrollbarWidth: 'none' }}>
          {REPORT_TYPES.map(rt => {
            const Icon = rt.icon
            const active = activeType === rt.id
            return (
              <button key={rt.id} onClick={() => setActiveType(rt.id)}
                className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-medium whitespace-nowrap transition-all flex-shrink-0"
                style={active
                  ? { background: '#6C5CE7', color: 'white', boxShadow: '0 4px 12px rgba(108,92,231,0.3)' }
                  : { background: 'rgba(255,255,255,0.55)', color: '#64748b', border: '1px solid rgba(255,255,255,0.7)' }}>
                <Icon size={14} />
                {rt.label}
              </button>
            )
          })}
        </div>

        {/* Centered period selector */}
        <div className="flex flex-col items-center gap-3 py-3">
          {isSingleMonth && (
            <MonthPicker year={selYear} month={selMonth}
              onChange={(y, m) => { setSelYear(y); setSelMonth(m) }} />
          )}
          {isRange && (
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <MonthPicker year={fromYear} month={fromMonth}
                onChange={(y, m) => { setFromYear(y); setFromMonth(m) }} />
              <span className="text-[20px] text-slate-300 font-light">→</span>
              <MonthPicker year={toYear} month={toMonth}
                onChange={(y, m) => { setToYear(y); setToMonth(m) }} />
            </div>
          )}
          {isCurrentStatus && (
            <div className="flex items-center gap-2 h-9 px-4 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.7)' }}>
              <Clock size={14} className="text-slate-400" />
              <span className="text-[13px] text-slate-500 font-medium">Current Status</span>
            </div>
          )}
        </div>

        {/* Export button */}
        <div className="flex justify-end pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.35)' }}>
          <button onClick={() => setShowExcelModal(true)} disabled={!reportData || loading}
            className="flex items-center gap-2 h-10 px-5 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-40"
            style={{ background: 'rgba(22,163,74,0.12)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.25)' }}>
            <Download size={15} /> Generate Excel
          </button>
        </div>
      </div>

      {/* Report content */}
      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.4)' }} />
            ))}
          </div>
          <div className="h-72 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.4)' }} />
          <div className="h-48 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.4)' }} />
        </div>
      ) : reportData ? (
        <div className="space-y-4">

          {/* ── FINANCIAL SUMMARY ── */}
          {reportData.type === 'financial' && (() => {
            const pct = reportData.collectPct
            const pctColor = pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#6C5CE7'
            const pctBar = pct >= 80
              ? 'linear-gradient(90deg, #34d399, #16a34a)'
              : pct >= 50
              ? 'linear-gradient(90deg, #fbbf24, #f59e0b)'
              : 'linear-gradient(90deg, #a78bfa, #6C5CE7)'
            const prevMonthLabel = fmtMY(reportData.prevMK)
            return (
              <>
                {/* 1 ── Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard
                    label="Expected Income" value={fmtMoney(reportData.projectedRent)}
                    sub="Monthly rent"
                    icon={Banknote} iconBg="rgba(108,92,231,0.1)" iconColor="text-violet-500"
                  />
                  <StatCard
                    label="Total Collected" value={fmtMoney(reportData.collected)}
                    valueColor="#16a34a"
                    icon={CheckCircle2} iconBg="rgba(22,163,74,0.1)" iconColor="text-emerald-600"
                  />
                  <StatCard
                    label="Remaining"
                    value={fmtMoney(reportData.remaining)}
                    valueColor={reportData.remaining > reportData.totalExpected * 0.3 ? '#dc2626' : '#d97706'}
                    icon={AlertTriangle}
                    iconBg={reportData.remaining > reportData.projectedRent * 0.3 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)'}
                    iconColor={reportData.remaining > reportData.projectedRent * 0.3 ? 'text-red-500' : 'text-amber-500'}
                  />
                  <StatCard
                    label="Overdue Renters"
                    value={`${reportData.unpaidCount}`}
                    sub={reportData.unpaidCount === 0 ? 'All up to date!' : `of ${reportData.totalCount} renters`}
                    valueColor={reportData.unpaidCount > 0 ? '#dc2626' : '#16a34a'}
                    icon={Users}
                    iconBg={reportData.unpaidCount > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(22,163,74,0.1)'}
                    iconColor={reportData.unpaidCount > 0 ? 'text-red-500' : 'text-emerald-600'}
                  />
                </div>

                {/* 2 ── Collection Progress Hero */}
                <div style={GLASS} className="p-5 sm:p-7">
                  <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Collection Progress</p>
                      <p className="text-[14px] font-semibold text-[#1e1b4b] mt-0.5">{fmtMY(monthKey(selYear, selMonth))}</p>
                    </div>
                    {reportData.vsLastMonth !== null && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-shrink-0"
                        style={reportData.vsLastMonth >= 0
                          ? { background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.2)' }
                          : { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                        {reportData.vsLastMonth >= 0
                          ? <TrendingUp size={12} className="text-emerald-500" />
                          : <TrendingDown size={12} className="text-red-400" />}
                        <p className="text-[12px] font-semibold"
                          style={{ color: reportData.vsLastMonth >= 0 ? '#16a34a' : '#dc2626' }}>
                          {reportData.vsLastMonth >= 0 ? '+' : ''}{reportData.vsLastMonth.toFixed(0)}% vs {prevMonthLabel}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
                    <div>
                      <p className="text-[48px] sm:text-[60px] font-bold tabular-nums leading-none" style={{ color: pctColor }}>
                        {pct.toFixed(0)}%
                      </p>
                      <p className="text-[14px] text-slate-400 mt-1.5">
                        {formatCurrency(reportData.collected)} collected of {formatCurrency(reportData.projectedRent)}
                      </p>
                    </div>
                    <div className="flex gap-5 sm:gap-7 pb-1">
                      <div className="text-center">
                        <p className="text-[26px] font-bold text-emerald-600 tabular-nums leading-none">{reportData.paidCount}</p>
                        <p className="text-[11px] text-slate-400 mt-1">paid</p>
                      </div>
                      <div className="w-px self-stretch" style={{ background: 'rgba(0,0,0,0.07)' }} />
                      <div className="text-center">
                        <p className="text-[26px] font-bold text-red-500 tabular-nums leading-none">{reportData.unpaidCount}</p>
                        <p className="text-[11px] text-slate-400 mt-1">unpaid</p>
                      </div>
                    </div>
                  </div>

                  <div className="h-4 sm:h-5 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(0,0,0,0.07)' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: pctBar }} />
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-slate-400">{formatCurrency(reportData.collected)} collected</span>
                    <span className="font-semibold" style={{ color: reportData.remaining > 0 ? '#dc2626' : '#16a34a' }}>
                      {reportData.remaining > 0 ? `${formatCurrency(reportData.remaining)} remaining` : '🎉 Fully collected!'}
                    </span>
                  </div>
                </div>

                {/* 3 ── Trend Chart + Breakdown (2/3 + 1/3) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Area Chart: Monthly Income Trend */}
                  <div style={GLASS} className="p-5 lg:col-span-2">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">Monthly Income Trend</p>
                    <p className="text-[12px] text-slate-400 mb-5">Total collected per month — last 6 months</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={reportData.trendChart} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="incomeArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="rgba(108,92,231,0.28)" />
                            <stop offset="95%" stopColor="rgba(108,92,231,0)" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.5)" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={v => v >= 1000 ? `₱${(v/1000).toFixed(0)}k` : `₱${v}`}
                          tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} />
                        <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(108,92,231,0.2)', strokeWidth: 1.5 }} />
                        <Area type="monotone" dataKey="Income" stroke="rgba(108,92,231,0.85)" strokeWidth={2.5}
                          fill="url(#incomeArea)" dot={false} activeDot={{ r: 5, fill: '#6C5CE7', strokeWidth: 0 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 6-Month Rent Summary */}
                  <div style={GLASS} className="p-5 flex flex-col gap-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">6-Month Rent Summary</p>
                      <p className="text-[12px] text-slate-400">Rent collected over the last 6 months</p>
                    </div>
                    {reportData.totalRent6 > 0 ? (
                      <div className="flex flex-col gap-3">
                        {[
                          { label: 'Total Collected', value: formatCurrency(reportData.totalRent6), color: '#6C5CE7' },
                          { label: 'Monthly Average', value: formatCurrency(reportData.avgMonthly6), color: '#0071E3' },
                          { label: 'Best Month',      value: reportData.bestMonth,                  color: '#16a34a' },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                            style={{ background: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.6)' }}>
                            <span className="text-[12px] text-slate-500">{label}</span>
                            <span className="text-[13px] font-bold tabular-nums" style={{ color }}>{value}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl mt-1"
                          style={{ background: 'rgba(108,92,231,0.07)', border: '1px solid rgba(108,92,231,0.15)' }}>
                          <span className="text-[12px] font-semibold text-slate-500">Collection Rate</span>
                          <span className="text-[13px] font-bold tabular-nums" style={{ color: reportData.collectPct >= 80 ? '#16a34a' : reportData.collectPct >= 50 ? '#d97706' : '#dc2626' }}>
                            {reportData.collectPct.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
                        <Banknote size={28} className="text-slate-200 mb-2" />
                        <p className="text-[13px] text-slate-400">No rent data yet.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4 ── Uncollected Trend */}
                <div style={GLASS} className="p-5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1">Uncollected Rent Trend</p>
                  <p className="text-[12px] text-slate-400 mb-4">Estimated unpaid rent per month</p>
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={reportData.overdueChart} barCategoryGap="40%">
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.5)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={v => v >= 1000 ? `₱${(v/1000).toFixed(0)}k` : `₱${v}`}
                        tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={46} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,59,48,0.04)' }} />
                      <Bar dataKey="Uncollected" fill="rgba(239,68,68,0.55)" radius={[5,5,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )
          })()}

          {/* ── ELECTRICITY PAYMENT HISTORY ── */}
          {reportData.type === 'electricity' && (() => {
            const q = elecSearch.trim().toLowerCase()
            const filtered = q
              ? reportData.rows.filter((r: any) =>
                  r.reference.toLowerCase().includes(q) ||
                  r.renter.toLowerCase().includes(q) ||
                  r.room.toLowerCase().includes(q) ||
                  r.date.toLowerCase().includes(q) ||
                  r.method.toLowerCase().includes(q) ||
                  r.month.toLowerCase().includes(q)
                )
              : reportData.rows
            const filteredTotal = filtered.reduce((s: number, r: any) => s + r.amount, 0)
            return (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <StatCard label="Total Payments" value={`${q ? filtered.length + ' / ' + reportData.count : reportData.count}`}
                    sub={`${fmtMY(monthKey(fromYear, fromMonth))} – ${fmtMY(monthKey(toYear, toMonth))}`}
                    icon={Zap} iconBg="rgba(245,158,11,0.12)" iconColor="text-amber-500" />
                  <StatCard label="Total Amount" value={fmtMoney(q ? filteredTotal : reportData.total)} valueColor="#16a34a"
                    icon={Banknote} iconBg="rgba(22,163,74,0.1)" iconColor="text-emerald-600" />
                </div>
                <div style={GLASS} className="overflow-hidden">
                  <div className="px-5 py-4 space-y-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-[14px] font-semibold text-[#1e1b4b]">Electricity Payment History</p>
                        <p className="text-[12px] text-slate-400">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="relative">
                      <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={elecSearch}
                        onChange={e => setElecSearch(e.target.value)}
                        placeholder="Search by ref#, renter, room, date, method…"
                        className="w-full h-9 pl-9 pr-4 rounded-xl text-[13px] text-[#1e1b4b] outline-none"
                        style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.7)' }}
                      />
                      {elecSearch && (
                        <button onClick={() => setElecSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full"
                          style={{ color: '#94a3b8' }}>
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  <ReportTable
                    columns={[
                      { key: 'reference', label: 'Ref #', bold: true, render: v => (
                        <span className="font-mono text-[12px] text-[#0071E3]">{v}</span>
                      )},
                      { key: 'datetime', label: 'Date & Time' },
                      { key: 'renter', label: 'Renter', bold: true },
                      { key: 'room', label: 'Room' },
                      { key: 'type', label: 'Type', render: v => (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ background: 'rgba(245,158,11,0.12)', color: '#d97706' }}>
                          {v}
                        </span>
                      )},
                      { key: 'amount', label: 'Amount', align: 'right', render: v => <span className="text-emerald-600 font-semibold">{formatCurrency(v)}</span> },
                      { key: 'method', label: 'Method' },
                      { key: 'month', label: 'Period' },
                    ]}
                    rows={filtered}
                    emptyText={q ? `No payments match "${elecSearch}".` : 'No confirmed electricity payments found for this date range.'}
                  />
                </div>
              </>
            )
          })()}

          {/* ── OVERDUE REPORT ── */}
          {reportData.type === 'overdue' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StatCard label="Overdue Renters" value={`${reportData.totalRenters}`}
                  valueColor={reportData.totalRenters > 0 ? '#dc2626' : '#1e1b4b'}
                  icon={AlertTriangle}
                  iconBg={reportData.totalRenters > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.4)'}
                  iconColor={reportData.totalRenters > 0 ? 'text-red-500' : 'text-slate-300'}
                  sub={reportData.totalRenters === 0 ? 'All renters are up to date' : undefined} />
                <StatCard label="Total Amount Due" value={fmtMoney(reportData.totalAmount)}
                  valueColor={reportData.totalAmount > 0 ? '#dc2626' : '#1e1b4b'}
                  icon={Banknote} iconBg="rgba(239,68,68,0.1)" iconColor="text-red-500" />
              </div>
              <div style={GLASS} className="overflow-hidden">
                <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
                  <p className="text-[14px] font-semibold text-[#1e1b4b]">Overdue Renters — Ranked by Balance</p>
                  <p className="text-[12px] text-slate-400">Sorted by highest overdue balance</p>
                </div>
                <ReportTable
                  columns={[
                    { key: 'rank', label: '#' },
                    { key: 'name', label: 'Renter', bold: true },
                    { key: 'room_number', label: 'Room', render: v => `Room ${v}` },
                    { key: 'months_overdue', label: 'Months Overdue', render: v => <OverdueBadge months={v} /> },
                    { key: 'monthly_rent', label: 'Monthly Rent', align: 'right', render: v => formatCurrency(v) },
                    { key: 'total_due', label: 'Total Due', align: 'right', bold: true, render: v => <span className="text-red-600 font-bold">{formatCurrency(v)}</span> },
                  ]}
                  rows={reportData.rows}
                  emptyText="All renters are up to date. No overdue payments."
                />
              </div>
            </>
          )}

          {/* ── PAYMENT HISTORY ── */}
          {reportData.type === 'payments' && (() => {
            const q = paymentSearch.trim().toLowerCase()
            const filtered = q
              ? reportData.rows.filter((r: any) =>
                  r.reference.toLowerCase().includes(q) ||
                  r.renter.toLowerCase().includes(q) ||
                  r.room.toLowerCase().includes(q) ||
                  r.date.toLowerCase().includes(q) ||
                  r.type.toLowerCase().includes(q) ||
                  r.method.toLowerCase().includes(q) ||
                  r.month.toLowerCase().includes(q)
                )
              : reportData.rows
            const filteredTotal = filtered.reduce((s: number, r: any) => s + r.amount, 0)
            return (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <StatCard label="Total Payments" value={`${q ? filtered.length + ' / ' + reportData.count : reportData.count}`}
                    sub={`${fmtMY(monthKey(fromYear, fromMonth))} – ${fmtMY(monthKey(toYear, toMonth))}`}
                    icon={CreditCard} iconBg="rgba(108,92,231,0.1)" iconColor="text-violet-500" />
                  <StatCard label="Total Amount" value={fmtMoney(q ? filteredTotal : reportData.total)} valueColor="#16a34a"
                    icon={Banknote} iconBg="rgba(22,163,74,0.1)" iconColor="text-emerald-600" />
                </div>
                <div style={GLASS} className="overflow-hidden">
                  <div className="px-5 py-4 space-y-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-[14px] font-semibold text-[#1e1b4b]">Rent Payment History</p>
                        <p className="text-[12px] text-slate-400">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    {/* Search bar */}
                    <div className="relative">
                      <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={paymentSearch}
                        onChange={e => setPaymentSearch(e.target.value)}
                        placeholder="Search by ref#, renter, room, date, type…"
                        className="w-full h-9 pl-9 pr-4 rounded-xl text-[13px] text-[#1e1b4b] outline-none"
                        style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.7)' }}
                      />
                      {paymentSearch && (
                        <button onClick={() => setPaymentSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full"
                          style={{ color: '#94a3b8' }}>
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  <ReportTable
                    columns={[
                      { key: 'reference', label: 'Ref #', bold: true, render: v => (
                        <span className="font-mono text-[12px] text-[#0071E3]">{v}</span>
                      )},
                      { key: 'datetime', label: 'Date & Time' },
                      { key: 'renter', label: 'Renter', bold: true },
                      { key: 'room', label: 'Room' },
                      { key: 'type', label: 'Type', render: v => (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                          style={v === 'Electricity'
                            ? { background: 'rgba(245,158,11,0.12)', color: '#d97706' }
                            : { background: 'rgba(108,92,231,0.12)', color: '#6C5CE7' }}>
                          {v}
                        </span>
                      )},
                      { key: 'amount', label: 'Amount', align: 'right', render: v => <span className="text-emerald-600 font-semibold">{formatCurrency(v)}</span> },
                      { key: 'method', label: 'Method' },
                      { key: 'month', label: 'Period' },
                    ]}
                    rows={filtered}
                    emptyText={q ? `No payments match "${paymentSearch}".` : 'No confirmed payments found for this date range.'}
                  />
                </div>
              </>
            )
          })()}

          {/* ── OCCUPANCY REPORT ── */}
          {reportData.type === 'occupancy' && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Total Rooms" value={`${reportData.total}`}
                  icon={DoorOpen} iconBg="rgba(108,92,231,0.1)" iconColor="text-violet-500" />
                <StatCard label="Occupied" value={`${reportData.occupied}`} valueColor="#6C5CE7"
                  icon={Users} iconBg="rgba(108,92,231,0.1)" iconColor="text-violet-500" />
                <StatCard label="Vacant" value={`${reportData.vacant}`} valueColor="#64748b"
                  icon={DoorOpen} iconBg="rgba(100,116,139,0.1)" iconColor="text-slate-400" />
                <StatCard label="Occupancy Rate" value={`${reportData.occupancyRate.toFixed(0)}%`}
                  valueColor={reportData.occupancyRate >= 80 ? '#16a34a' : reportData.occupancyRate >= 50 ? '#d97706' : '#dc2626'}
                  icon={TrendingUp} iconBg="rgba(22,163,74,0.1)" iconColor="text-emerald-600" />
              </div>
              {reportData.maintenance > 0 && (
                <div className="px-5 py-3 rounded-xl flex items-center gap-3"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <AlertTriangle size={15} className="text-amber-500 flex-shrink-0" />
                  <p className="text-[13px] text-amber-700">{reportData.maintenance} room{reportData.maintenance !== 1 ? 's' : ''} under maintenance</p>
                </div>
              )}
              <div style={GLASS} className="overflow-hidden">
                <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
                  <p className="text-[14px] font-semibold text-[#1e1b4b]">Room Details</p>
                  <p className="text-[12px] text-slate-400">{reportData.total} room{reportData.total !== 1 ? 's' : ''} total</p>
                </div>
                <ReportTable
                  columns={[
                    { key: 'room_number', label: 'Room', bold: true, render: v => `Room ${v}` },
                    { key: 'floor', label: 'Floor' },
                    { key: 'tenant_name', label: 'Tenant', render: v => v ?? <span className="text-slate-400 italic">Vacant</span> },
                    { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
                    { key: 'rent_amount', label: 'Rent', align: 'right', render: v => formatCurrency(v) },
                    { key: 'occupants', label: 'Occupants', align: 'right', render: v => v ?? '—' },
                  ]}
                  rows={reportData.rows}
                  emptyText="No rooms found."
                />
              </div>
            </>
          )}

        </div>
      ) : !loading && buildingIds.length === 0 ? (
        <div style={GLASS} className="py-16 text-center">
          <DoorOpen size={36} className="text-slate-300 mx-auto mb-3" />
          <p className="text-[15px] font-semibold text-[#1e1b4b]">No buildings found</p>
          <p className="text-[13px] text-slate-400 mt-1">Add a building first to generate reports.</p>
        </div>
      ) : null}

    </div>
  )
}
