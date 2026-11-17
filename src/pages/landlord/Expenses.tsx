// @ts-nocheck
import { useEffect, useState, useRef } from 'react'
import { Plus, X, Receipt, Upload, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency, formatDate } from '@/lib/utils'
import { DatePicker } from '@/components/ui/DatePicker'

const GLASS = {
  background: 'rgba(255,255,255,0.22)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.45)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(108,92,231,0.06), 0 1px 1px rgba(255,255,255,0.5) inset',
}

const LABEL = 'block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5'
const INPUT = 'w-full h-11 rounded-xl px-4 text-[15px] text-[#1e1b4b] outline-none transition-all'
const INPUT_STYLE = { background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.7)' }

const CATEGORIES = [
  { value: 'water', label: 'Water', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  { value: 'maintenance', label: 'Maintenance', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { value: 'repair', label: 'Repair', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  { value: 'supplies', label: 'Supplies', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  { value: 'other', label: 'Other', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
]

function catStyle(value: string) {
  return CATEGORIES.find(c => c.value === value) ?? CATEGORIES[4]
}

type Building = { id: string; name: string }
type Expense = {
  id: string; building_id: string; building_name: string; category: string
  amount: number; expense_date: string; notes: string | null; photo_url: string | null; created_at: string
}

function AddExpenseModal({ buildings, onClose, onSaved }: {
  buildings: Building[]; onClose: () => void; onSaved: () => void
}) {
  const buildingId = buildings[0]?.id ?? ''
  const [category, setCategory] = useState('maintenance')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) return
    setLoading(true); setError('')

    let photoUrl: string | null = null
    if (photoFile) {
      const ext = photoFile.name.split('.').pop()
      const path = `expense-${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('expense-receipts').upload(path, photoFile, { upsert: true })
      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('expense-receipts').getPublicUrl(path)
        photoUrl = publicUrl
      }
    }

    const { error: err } = await supabase.from('expenses').insert({
      building_id: buildingId,
      category,
      amount: parseFloat(amount),
      expense_date: date,
      notes: notes || null,
      photo_url: photoUrl,
    })

    if (err) { setError(err.message); setLoading(false); return }
    onSaved(); onClose()
  }

  const modalStyle = {
    background: 'rgba(255,255,255,0.88)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    border: '1px solid rgba(255,255,255,0.7)',
    borderRadius: 20,
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto" style={modalStyle}>
        <div className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.5)' }}>
          <h2 className="text-[18px] font-semibold text-[#1e1b4b]">Add Expense</h2>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400"
            style={{ background: 'rgba(0,0,0,0.05)' }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 rounded-xl text-sm text-red-600">{error}</div>}

          <DatePicker label="Date" value={date} onChange={setDate} variant="glass" />

          <div>
            <label className={LABEL}>Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button key={c.value} type="button" onClick={() => setCategory(c.value)}
                  className="px-3 py-1.5 rounded-full text-[13px] font-medium transition-all"
                  style={category === c.value
                    ? { background: c.bg, color: c.color, border: `1px solid ${c.color}40` }
                    : { background: 'rgba(255,255,255,0.5)', color: '#64748b', border: '1px solid rgba(255,255,255,0.7)' }
                  }>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={LABEL}>Amount (₱)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.00" min="0" step="0.01" required
              className={INPUT} style={INPUT_STYLE} />
          </div>

          <div>
            <label className={LABEL}>Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Optional description…"
              className={INPUT} style={INPUT_STYLE} />
          </div>

          {/* Photo upload */}
          <div>
            <label className={LABEL}>Receipt Photo (optional)</label>
            {photoPreview ? (
              <div className="relative w-full h-32 rounded-xl overflow-hidden">
                <img src={photoPreview} className="w-full h-full object-cover" alt="Receipt" />
                <button type="button" onClick={() => { setPhotoPreview(''); setPhotoFile(null) }}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full h-16 rounded-xl flex items-center justify-center gap-2 text-[13px] text-slate-400 transition-all"
                style={{ border: '2px dashed rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.3)' }}>
                <Upload size={16} /> Upload receipt photo
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (!f) return
                setPhotoFile(f)
                setPhotoPreview(URL.createObjectURL(f))
              }} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 h-11 rounded-xl font-medium text-[15px] text-[#1e1b4b]"
              style={{ background: 'rgba(0,0,0,0.06)' }}>Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 h-11 rounded-xl font-medium text-[15px] text-white disabled:opacity-50"
              style={{ background: 'rgba(108,92,231,0.85)', boxShadow: '0 4px 12px rgba(108,92,231,0.3)' }}>
              {loading ? 'Saving…' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Expenses() {
  const { profile } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [buildings, setBuildings] = useState<Building[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filterBuilding, setFilterBuilding] = useState('all')
  const [filterMonth, setFilterMonth] = useState('')
  const [profitData, setProfitData] = useState<{ building: string; rent: number; expenses: number }[]>([])

  useEffect(() => { init() }, [])

  async function init() {
    setLoading(true)
    const [{ data: blds }, { data: exps }] = await Promise.all([
      supabase.from('buildings').select('id, name').eq('landlord_id', profile!.id).order('name'),
      supabase.from('expenses')
        .select('id, building_id, category, amount, expense_date, notes, photo_url, created_at, building:buildings(name)')
        .order('expense_date', { ascending: false })
        .limit(200),
    ])
    setBuildings(blds ?? [])

    // Filter to only landlord's buildings
    const landlordBuildingIds = new Set((blds ?? []).map(b => b.id))
    const filtered = (exps ?? []).filter((e: any) => landlordBuildingIds.has(e.building_id))
    setExpenses(filtered.map((e: any) => ({ ...e, building_name: e.building?.name ?? '' })))

    // Profit data
    await fetchProfitData(blds ?? [])
    setLoading(false)
  }

  async function fetchProfitData(blds: Building[]) {
    const now = new Date()
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const results = await Promise.all(blds.map(async b => {
      const [{ data: rooms }, { data: expData }] = await Promise.all([
        supabase.from('rooms').select('id').eq('building_id', b.id),
        supabase.from('expenses').select('amount').eq('building_id', b.id).like('expense_date', `${monthYear}%`),
      ])
      const roomIds = (rooms ?? []).map(r => r.id)
      let rent = 0
      if (roomIds.length > 0) {
        const { data: payments } = await supabase
          .from('payments').select('amount')
          .in('room_id', roomIds)
          .eq('month_year', monthYear)
          .in('status', ['confirmed', 'verified'])
        rent = (payments ?? []).reduce((s: number, p: any) => s + p.amount, 0)
      }
      const totalExp = (expData ?? []).reduce((s: number, e: any) => s + e.amount, 0)
      return { building: b.name, rent, expenses: totalExp }
    }))
    setProfitData(results)
  }

  async function deleteExpense(id: string) {
    if (!confirm('Delete this expense?')) return
    await supabase.from('expenses').delete().eq('id', id)
    init()
  }

  const filtered = expenses.filter(e => {
    const byBuilding = filterBuilding === 'all' || e.building_id === filterBuilding
    const byMonth = !filterMonth || e.expense_date.startsWith(filterMonth)
    return byBuilding && byMonth
  })

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#1e1b4b]">Expenses</h1>
          <p className="text-[15px] text-slate-400 mt-0.5">Track building expenses and view profit</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 h-10 px-4 text-white rounded-xl text-[14px] font-medium"
          style={{ background: 'rgba(108,92,231,0.85)', boxShadow: '0 4px 12px rgba(108,92,231,0.3)' }}>
          <Plus size={16} /> Add Expense
        </button>
      </div>

      {/* Profit summary */}
      {profitData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profitData.map(p => {
            const net = p.rent - p.expenses
            const positive = net >= 0
            return (
              <div key={p.building} style={GLASS} className="p-5">
                <p className="text-[12px] font-semibold uppercase tracking-widest text-slate-400 mb-3">{p.building}</p>
                <div className="space-y-1.5 mb-3">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-slate-400">Rent collected</span>
                    <span className="font-semibold text-green-600 tabular-nums">{formatCurrency(p.rent)}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-slate-400">Total expenses</span>
                    <span className="font-semibold text-red-500 tabular-nums">{formatCurrency(p.expenses)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.4)' }}>
                  <span className="text-[12px] font-semibold uppercase tracking-widest text-slate-400">Net Profit</span>
                  <div className="flex items-center gap-1.5">
                    {positive
                      ? <TrendingUp size={14} className="text-green-600" />
                      : <TrendingDown size={14} className="text-red-500" />
                    }
                    <span className={`text-[18px] font-bold tabular-nums ${positive ? 'text-green-600' : 'text-red-500'}`}>
                      {positive ? '' : '-'}{formatCurrency(Math.abs(net))}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Filters */}
      <div style={GLASS} className="p-5">
        <div className="flex flex-wrap gap-3">
          <select value={filterBuilding} onChange={e => setFilterBuilding(e.target.value)}
            className="h-10 rounded-xl px-3 text-[14px] text-[#1e1b4b] outline-none"
            style={INPUT_STYLE}>
            <option value="all">All Buildings</option>
            {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            className="h-10 rounded-xl px-3 text-[14px] text-[#1e1b4b] outline-none"
            style={INPUT_STYLE} />
          {filterMonth && (
            <button onClick={() => setFilterMonth('')}
              className="h-10 px-3 rounded-xl text-[13px] text-slate-400 transition-all"
              style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.6)' }}>
              Clear
            </button>
          )}
          <div className="ml-auto text-[14px] font-semibold text-[#1e1b4b] flex items-center">
            Total: {formatCurrency(totalFiltered)}
          </div>
        </div>
      </div>

      {/* Expense list */}
      {loading ? (
        <div style={GLASS} className="p-6 space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.4)' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={GLASS} className="p-16 text-center">
          <Receipt size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-[15px] font-medium text-slate-500 mb-1">No expenses recorded</p>
          <p className="text-[13px] text-slate-400">Add your first expense to start tracking costs.</p>
        </div>
      ) : (
        <div style={GLASS} className="overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[80px_1fr_120px_100px_1fr_48px] px-5 py-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
            {['Date', 'Building', 'Category', 'Amount', 'Notes', ''].map((h, i) => (
              <span key={i} className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{h}</span>
            ))}
          </div>

          {filtered.map((exp, i) => {
            const cat = catStyle(exp.category)
            return (
              <div key={exp.id}
                className="flex flex-col sm:grid sm:grid-cols-[80px_1fr_120px_100px_1fr_48px] items-start sm:items-center px-5 py-4 gap-2 sm:gap-0"
                style={{ borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.3)' : undefined }}>
                <span className="text-[13px] text-slate-400">{formatDate(exp.expense_date)}</span>
                <span className="text-[13px] font-medium text-[#1e1b4b]">{exp.building_name}</span>
                <span className="inline-flex items-center text-[12px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: cat.bg, color: cat.color }}>
                  {cat.label}
                </span>
                <span className="text-[14px] font-semibold text-[#1e1b4b] tabular-nums">{formatCurrency(exp.amount)}</span>
                <span className="text-[13px] text-slate-400 truncate">{exp.notes ?? '—'}</span>
                <button onClick={() => deleteExpense(exp.id)}
                  className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255,59,48,0.08)' }}>
                  <Trash2 size={13} className="text-red-500" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <AddExpenseModal
          buildings={buildings}
          onClose={() => setShowModal(false)}
          onSaved={init}
        />
      )}
    </div>
  )
}
