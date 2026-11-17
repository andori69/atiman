// @ts-nocheck
import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
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

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function getLast6Months(): { key: string; label: string }[] {
  const months = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push({ key, label: `${MONTH_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` })
  }
  return months
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="px-4 py-3 rounded-xl shadow-lg"
      style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(255,255,255,0.7)', minWidth: 160 }}>
      <p className="text-[12px] font-semibold text-slate-400 mb-2 uppercase tracking-wide">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4 text-[13px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.fill }} />
            <span className="text-slate-500">{p.name}</span>
          </span>
          <span className="font-semibold text-[#1e1b4b] tabular-nums">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Forecast() {
  const { profile } = useAuth()
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState({ projected: 0, collected: 0 })
  const [collectionRate, setCollectionRate] = useState(0)
  const [prevRate, setPrevRate] = useState(0)

  useEffect(() => { init() }, [])

  async function init() {
    setLoading(true)
    const months = getLast6Months()

    // Get landlord's buildings → rooms → tenants
    const { data: buildings } = await supabase
      .from('buildings').select('id').eq('landlord_id', profile!.id)
    const buildingIds = (buildings ?? []).map(b => b.id)
    if (buildingIds.length === 0) { setLoading(false); return }

    const { data: rooms } = await supabase
      .from('rooms').select('id').in('building_id', buildingIds)
    const roomIds = (rooms ?? []).map(r => r.id)

    // Fetch all active tenants with their rent amounts
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, room_id, occupants, room:rooms(rent_amount)')
      .eq('is_active', true)
      .not('room_id', 'is', null)
      .in('room_id', roomIds)

    // Calculate per-person rent for each tenant using room-level occupant totals
    const SOLO_DISCOUNT = 500
    function perPersonRent(roomRent: number, occ: number) {
      return occ <= 1 ? roomRent - SOLO_DISCOUNT : roomRent / occ
    }
    // Build room-level totals so sharing tenants don't each get the solo discount
    const roomOccMap = new Map<string, number>()
    for (const t of tenants ?? []) {
      if (t.room_id) roomOccMap.set(t.room_id, (roomOccMap.get(t.room_id) ?? 0) + (t.occupants ?? 1))
    }
    const projectedPerMonth = (tenants ?? []).reduce((sum: number, t: any) => {
      const rent = t.room?.rent_amount ?? 0
      const roomOcc = t.room_id ? (roomOccMap.get(t.room_id) ?? 1) : 1
      return sum + perPersonRent(rent, roomOcc)
    }, 0)

    // Fetch actual payments per month
    const { data: payments } = await supabase
      .from('payments')
      .select('amount, month_year, status')
      .in('room_id', roomIds)
      .in('status', ['confirmed', 'verified'])
      .in('month_year', months.map(m => m.key))

    const payByMonth: Record<string, number> = {}
    for (const p of payments ?? []) {
      payByMonth[p.month_year] = (payByMonth[p.month_year] ?? 0) + p.amount
    }

    const data = months.map(m => ({
      month: m.label,
      Projected: Math.round(projectedPerMonth),
      Collected: Math.round(payByMonth[m.key] ?? 0),
    }))
    setChartData(data)

    // Current month stats
    const now = new Date()
    const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const curCollected = payByMonth[curKey] ?? 0
    setCurrentMonth({ projected: projectedPerMonth, collected: curCollected })

    // Collection rate current vs prev month
    const curRate = projectedPerMonth > 0 ? (curCollected / projectedPerMonth) * 100 : 0
    const prevKey = months[months.length - 2]?.key
    const prevCollected = payByMonth[prevKey] ?? 0
    const prevR = projectedPerMonth > 0 ? (prevCollected / projectedPerMonth) * 100 : 0
    setCollectionRate(curRate)
    setPrevRate(prevR)

    setLoading(false)
  }

  const remaining = Math.max(0, currentMonth.projected - currentMonth.collected)
  const collectPct = currentMonth.projected > 0
    ? Math.min(100, (currentMonth.collected / currentMonth.projected) * 100)
    : 0
  const rateDiff = collectionRate - prevRate

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.4)' }} />
        <div className="h-64 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.35)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1e1b4b]">Rent Forecast</h1>
        <p className="text-[15px] text-slate-400 mt-0.5">6-month projected vs collected overview</p>
      </div>

      {/* Cash flow card */}
      <div style={GLASS} className="p-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-4">This Month</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div>
            <p className="text-[12px] text-slate-400 mb-0.5">Expected</p>
            <p className="text-[24px] font-bold text-[#1e1b4b] tabular-nums">{formatCurrency(currentMonth.projected)}</p>
          </div>
          <div>
            <p className="text-[12px] text-slate-400 mb-0.5">Collected</p>
            <p className="text-[24px] font-bold text-green-600 tabular-nums">{formatCurrency(currentMonth.collected)}</p>
          </div>
          <div>
            <p className="text-[12px] text-slate-400 mb-0.5">Remaining</p>
            <p className="text-[24px] font-bold text-amber-500 tabular-nums">{formatCurrency(remaining)}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-3 rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.6)' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${collectPct}%`,
              background: collectPct >= 80
                ? 'rgba(52,199,89,0.85)'
                : collectPct >= 50
                ? 'rgba(255,149,0,0.85)'
                : 'rgba(108,92,231,0.85)',
            }} />
        </div>
        <p className="text-[12px] text-slate-400 mt-2">{collectPct.toFixed(0)}% collected this month</p>
      </div>

      {/* Collection rate stat */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div style={GLASS} className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Collection Rate</p>
          <p className="text-[28px] font-bold text-[#1e1b4b] tabular-nums">{collectionRate.toFixed(0)}%</p>
          <div className="flex items-center gap-1 mt-1">
            {rateDiff > 0
              ? <TrendingUp size={14} className="text-green-500" />
              : rateDiff < 0
              ? <TrendingDown size={14} className="text-red-500" />
              : <Minus size={14} className="text-slate-400" />
            }
            <span className={`text-[12px] font-medium ${
              rateDiff > 0 ? 'text-green-600' : rateDiff < 0 ? 'text-red-500' : 'text-slate-400'
            }`}>
              {rateDiff > 0 ? '+' : ''}{rateDiff.toFixed(0)}% vs last month
            </span>
          </div>
        </div>

        <div style={GLASS} className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Monthly Target</p>
          <p className="text-[28px] font-bold text-[#6C5CE7] tabular-nums">{formatCurrency(currentMonth.projected)}</p>
          <p className="text-[12px] text-slate-400 mt-1">Based on active tenants</p>
        </div>

        <div style={GLASS} className="p-5 col-span-2 sm:col-span-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Uncollected</p>
          <p className="text-[28px] font-bold text-amber-500 tabular-nums">{formatCurrency(remaining)}</p>
          <p className="text-[12px] text-slate-400 mt-1">Outstanding this month</p>
        </div>
      </div>

      {/* Bar chart */}
      <div style={GLASS} className="p-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-5">
          6-Month Overview
        </p>
        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center">
            <p className="text-[14px] text-slate-400">No data available yet.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} barGap={4} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.5)" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false} tickLine={false} width={52}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(108,92,231,0.04)' }} />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 16, color: '#94a3b8' }}
              />
              <Bar dataKey="Projected" fill="rgba(108,92,231,0.2)" radius={[6,6,0,0]} />
              <Bar dataKey="Collected" fill="rgba(108,92,231,0.78)" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
