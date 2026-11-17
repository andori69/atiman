// @ts-nocheck
import { useEffect, useState, useRef, useMemo, useCallback, memo } from 'react'
import {
  Plus, DoorOpen, X, Pencil, Trash2, BedDouble, Users, Layers, ChevronDown,
  Search, UserPlus, CheckCircle2, AlertCircle, AlertTriangle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency } from '@/lib/utils'
import type { Room } from '@/types/database'

const SOLO_DISCOUNT = 500

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
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.5)',
  borderRadius: 14,
  boxShadow: '0 4px 16px rgba(108,92,231,0.05)',
}

const GLASS_MODAL = {
  background: 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.65)',
  borderRadius: 20,
  boxShadow: '0 24px 64px rgba(100,80,200,0.18)',
}

const INPUT_STYLE = {
  background: 'rgba(255,255,255,0.5)',
  border: '1px solid rgba(255,255,255,0.65)',
  borderRadius: 12,
}

function calcPerPerson(roomRent: number, count: number): number {
  if (count === 0) return roomRent
  if (count === 1) return roomRent - SOLO_DISCOUNT
  return roomRent / count
}

function statusBadgeStyle(status: Room['status']) {
  if (status === 'occupied') return { background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.15)' }
  if (status === 'maintenance') return { background: 'rgba(245,158,11,0.1)', color: '#d97706', border: '1px solid rgba(245,158,11,0.15)' }
  return { background: 'rgba(148,163,184,0.12)', color: '#64748b', border: '1px solid rgba(148,163,184,0.2)' }
}

function statusLabel(status: Room['status']) {
  if (status === 'occupied') return 'Occupied'
  if (status === 'maintenance') return 'Maintenance'
  return 'Vacant'
}

function floorLabel(n: number) {
  if (n === 1) return '1st Floor'
  if (n === 2) return '2nd Floor'
  if (n === 3) return '3rd Floor'
  return `${n}th Floor`
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function avatarColor(name: string) {
  const c = ['bg-violet-400','bg-blue-400','bg-emerald-400','bg-amber-400','bg-rose-400','bg-cyan-400','bg-indigo-400','bg-teal-400']
  let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % c.length; return c[h]
}

function generateRoomNumbers(start: string, count: number): string[] {
  const num = parseInt(start, 10)
  if (isNaN(num) || num < 0) return []
  const padLen = /^0\d/.test(start) ? start.length : 0
  return Array.from({ length: count }, (_, i) => {
    const n = num + i
    return padLen > 0 ? String(n).padStart(padLen, '0') : String(n)
  })
}

/* ── Memoized Room Card ── avoids re-rendering unchanged cards */
const RoomCard = memo(function RoomCard({ room, editMode, onView, onEdit, onDelete }: {
  room: any; editMode: boolean
  onView: (r: any) => void; onEdit: (r: any) => void; onDelete: (r: any) => void
}) {
  const activeTenants = useMemo(
    () => (room.tenants ?? []).filter((t: any) => t.is_active),
    [room.tenants]
  )
  const count = activeTenants.reduce((s: number, t: any) => s + (t.occupants ?? 1), 0)
  const perPerson = calcPerPerson(room.rent_amount, count)

  return (
    <div
      className="p-4 transition-all cursor-pointer"
      style={editMode ? { ...GLASS_CARD, border: '1px solid rgba(245,158,11,0.35)' } : GLASS_CARD}
      onClick={() => editMode ? onEdit(room) : onView(room)}
      onMouseEnter={e => { if (!editMode) (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = '' }}
    >
      <div className="flex items-start justify-between mb-2.5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.45)' }}>
          <BedDouble size={16} className="text-slate-400" />
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={statusBadgeStyle(room.status)}>
          {statusLabel(room.status)}
        </span>
      </div>

      <p className="text-[16px] font-bold text-[#1e1b4b] mb-1">Room {room.room_number}</p>
      {room.floor_number != null && (
        <p className="text-[10px] text-slate-300 mb-1">{floorLabel(room.floor_number)}</p>
      )}

      {count > 0 ? (
        <div className="mb-2.5 space-y-0.5">
          {activeTenants.slice(0, 2).map((t: any) => (
            <p key={t.id} className="text-[11px] text-slate-400 truncate flex items-center gap-1">
              <Users size={10} className="text-slate-300 flex-shrink-0" /> {t.name}
            </p>
          ))}
          {activeTenants.length > 2 && <p className="text-[11px] text-slate-300">+{activeTenants.length - 2} more</p>}
        </div>
      ) : (
        room.description
          ? <p className="text-[11px] text-slate-400 mb-2.5 line-clamp-1">{room.description}</p>
          : <p className="text-[11px] text-slate-300 italic mb-2.5">No renters</p>
      )}

      {count > 0
        ? <p className="text-[13px] font-bold text-[#6C5CE7] tabular-nums mb-3">{formatCurrency(perPerson)}<span className="text-[10px] font-normal text-slate-300">/person</span></p>
        : <p className="text-[13px] font-bold text-[#6C5CE7] tabular-nums mb-3">{formatCurrency(room.rent_amount)}<span className="text-[10px] font-normal text-slate-300">/mo</span></p>
      }

      {editMode ? (
        <div className="flex justify-end mt-1" onClick={e => { e.stopPropagation(); onDelete(room) }}>
          <button
            className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444' }}>
            <Trash2 size={13} />
          </button>
        </div>
      ) : (
        <p className="text-[10px] text-slate-300 text-center">Tap to view details</p>
      )}
    </div>
  )
})

/* ── Room Detail Modal ── lazy-loads payments only when opened */
function RoomDetailModal({ room, onClose, onEdit, onAddRenter }: {
  room: any; onClose: () => void; onEdit: () => void; onAddRenter: () => void
}) {
  const [payments, setPayments] = useState<any[]>([])
  const [loadingPayments, setLoadingPayments] = useState(true)

  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthLabel = now.toLocaleString('en-PH', { month: 'long', year: 'numeric' })

  useEffect(() => {
    const activeTenants = (room.tenants ?? []).filter((t: any) => t.is_active)
    if (!activeTenants.length) { setLoadingPayments(false); return }
    const ids = activeTenants.map((t: any) => t.id)
    supabase.from('payments').select('tenant_id, amount, status')
      .in('tenant_id', ids).eq('month_year', monthKey).in('status', ['confirmed', 'verified'])
      .then(({ data }) => { setPayments(data ?? []); setLoadingPayments(false) })
  }, [room.id])

  const activeTenants = (room.tenants ?? []).filter((t: any) => t.is_active)
  const count = activeTenants.reduce((s: number, t: any) => s + (t.occupants ?? 1), 0)
  const perPerson = calcPerPerson(room.rent_amount, count)
  const paidSet = new Set(payments.map(p => p.tenant_id))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl max-h-[88vh] flex flex-col overflow-hidden"
        style={{ ...GLASS_MODAL, animation: 'slideUp 200ms ease-out' }}>

        <div className="px-6 py-5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="text-[22px] font-bold text-[#1e1b4b]">Room {room.room_number}</h2>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full" style={statusBadgeStyle(room.status)}>
                  {statusLabel(room.status)}
                </span>
              </div>
              <p className="text-[12px] text-slate-400">
                {room.floor_number ? floorLabel(room.floor_number) : 'No floor assigned'}
                {room.description ? ` · ${room.description}` : ''}
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-slate-400 flex-shrink-0"
              style={{ background: 'rgba(0,0,0,0.05)' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-4" style={{ background: 'rgba(108,92,231,0.07)', border: '1px solid rgba(108,92,231,0.12)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-1">Room Rate</p>
              <p className="text-[22px] font-bold text-[#6C5CE7] tabular-nums leading-tight">{formatCurrency(room.rent_amount)}</p>
              <p className="text-[11px] text-violet-300">/month total</p>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Occupancy</p>
              <p className="text-[22px] font-bold text-[#1e1b4b] leading-tight">{count}</p>
              <p className="text-[11px] text-slate-400">{count === 1 ? 'person' : count === 0 ? 'vacant' : 'people'}</p>
            </div>
          </div>

          {count > 0 && (
            <div className="rounded-xl px-4 py-3 flex items-center justify-between"
              style={{ background: 'rgba(108,92,231,0.05)', border: '1px solid rgba(108,92,231,0.1)' }}>
              <p className="text-[12px] text-slate-500">
                {count === 1 ? 'Solo occupant · ₱500 discount applied' : `${count} sharing · split equally`}
              </p>
              <p className="text-[14px] font-bold text-[#6C5CE7] tabular-nums">{formatCurrency(perPerson)}<span className="text-[11px] font-normal text-slate-400">/person</span></p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Renters — <span className="text-slate-300 normal-case font-normal">{monthLabel}</span>
              </p>
              <button onClick={onAddRenter}
                className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: '#6C5CE7', boxShadow: '0 2px 8px rgba(108,92,231,0.3)' }}>
                <UserPlus size={12} /> Add Renter
              </button>
            </div>

            {activeTenants.length === 0 ? (
              <div className="rounded-xl p-6 text-center" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.05)' }}>
                <DoorOpen size={22} className="text-slate-300 mx-auto mb-2" />
                <p className="text-[13px] font-semibold text-slate-500">No renters assigned</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Tap "Add Renter" to assign someone</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeTenants.map((t: any) => {
                  const paid = paidSet.has(t.id)
                  return (
                    <div key={t.id} className="flex items-center gap-3 p-3.5 rounded-xl"
                      style={{
                        background: paid ? 'rgba(16,185,129,0.06)' : 'rgba(255,59,48,0.05)',
                        border: paid ? '1px solid rgba(16,185,129,0.18)' : '1px solid rgba(255,59,48,0.14)',
                      }}>
                      <div className={`w-9 h-9 rounded-full ${avatarColor(t.name)} flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0`}>
                        {initials(t.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[#1e1b4b] truncate">{t.name}</p>
                        <p className="text-[11px] text-slate-400 tabular-nums">{formatCurrency(perPerson)}/person</p>
                      </div>
                      {loadingPayments ? (
                        <div className="w-12 h-5 rounded-full animate-pulse" style={{ background: 'rgba(0,0,0,0.06)' }} />
                      ) : paid ? (
                        <div className="flex items-center gap-1 text-emerald-600 flex-shrink-0">
                          <CheckCircle2 size={15} />
                          <span className="text-[11px] font-bold">Paid</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-500 flex-shrink-0">
                          <AlertCircle size={15} />
                          <span className="text-[11px] font-bold">Unpaid</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {activeTenants.length > 0 && !loadingPayments && (
            <div className="flex items-center gap-4 justify-center text-[11px] text-slate-400">
              <div className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-500" /> Paid for {monthLabel}</div>
              <div className="flex items-center gap-1"><AlertCircle size={12} className="text-red-400" /> Not yet paid</div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <button onClick={onEdit}
            className="w-full h-11 rounded-xl font-semibold text-[14px] flex items-center justify-center gap-2 transition-all"
            style={{ background: 'rgba(108,92,231,0.1)', color: '#6C5CE7', border: '1px solid rgba(108,92,231,0.18)' }}>
            <Pencil size={15} /> Edit Room Details
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Pick Renter Modal ── */
function PickRenterModal({ room, landlordId, onClose, onSaved }: {
  room: any; landlordId: string; onClose: () => void; onSaved: () => void
}) {
  const [renters, setRenters] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: profiles }, { data: activeTenants }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, phone')
          .eq('role', 'renter').eq('status', 'approved').eq('linked_landlord_id', landlordId),
        supabase.from('tenants').select('user_id').eq('is_active', true)
          .not('room_id', 'is', null).not('user_id', 'is', null),
      ])
      const assignedIds = new Set((activeTenants ?? []).map((t: any) => t.user_id).filter(Boolean))
      setRenters((profiles ?? []).filter((p: any) => !assignedIds.has(p.id)))
      setLoading(false)
    }
    load()
  }, [landlordId])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return !q ? renters : renters.filter(r =>
      r.full_name?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q) || r.phone?.includes(q)
    )
  }, [renters, search])

  async function handleSelect(renter: any) {
    setSaving(true); setError('')
    const today = new Date().toISOString().split('T')[0]
    const { error: tErr } = await supabase.from('tenants').insert({
      room_id: room.id, user_id: renter.id, name: renter.full_name,
      phone: renter.phone ?? null, email: renter.email ?? null,
      move_in_date: today, is_active: true, occupants: 1, deposit_amount: 0,
    })
    if (tErr) { setError(tErr.message); setSaving(false); return }
    await supabase.from('rooms').update({ status: 'occupied' }).eq('id', room.id)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl flex flex-col overflow-hidden"
        style={{ ...GLASS_MODAL, maxHeight: '80vh', animation: 'slideUp 200ms ease-out' }}>

        <div className="px-6 py-5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[17px] font-bold text-[#1e1b4b]">Assign Renter</h2>
            <button onClick={onClose} className="p-2 rounded-xl text-slate-400" style={{ background: 'rgba(0,0,0,0.05)' }}>
              <X size={18} />
            </button>
          </div>
          <p className="text-[12px] text-slate-400 mb-4">Room {room.room_number} · select a registered renter</p>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, or phone…" autoFocus
              className="w-full h-10 rounded-xl pl-9 pr-4 text-[13px] text-[#1e1b4b] placeholder-slate-300 outline-none"
              style={INPUT_STYLE} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {error && <div className="mb-3 px-4 py-3 rounded-xl text-[13px] text-red-600" style={{ background: 'rgba(255,59,48,0.08)' }}>{error}</div>}
          {loading ? (
            <div className="space-y-2 p-1">
              {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'rgba(0,0,0,0.05)' }} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <Users size={28} className="text-slate-300 mb-2" />
              <p className="text-[14px] font-semibold text-slate-500">
                {renters.length === 0 ? 'No unassigned renters' : 'No matches'}
              </p>
              <p className="text-[12px] text-slate-400 mt-1">
                {renters.length === 0 ? 'All registered renters are already assigned to a room' : 'Try a different search'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((renter: any) => (
                <button key={renter.id} onClick={() => !saving && handleSelect(renter)} disabled={saving}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all disabled:opacity-50"
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(108,92,231,0.07)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <div className={`w-10 h-10 rounded-full ${avatarColor(renter.full_name ?? '')} flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0`}>
                    {initials(renter.full_name ?? '?')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#1e1b4b] truncate">{renter.full_name}</p>
                    <p className="text-[12px] text-slate-400 truncate">{renter.email ?? renter.phone ?? 'No contact info'}</p>
                  </div>
                  {saving
                    ? <div className="w-5 h-5 rounded-full border-2 border-violet-300 border-t-violet-600 animate-spin flex-shrink-0" />
                    : <UserPlus size={15} className="text-violet-400 flex-shrink-0" />
                  }
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Single Room Modal ── */
function RoomModal({ room, buildingId, onClose, onSaved }: {
  room?: Room; buildingId: string; onClose: () => void; onSaved: () => void
}) {
  const [roomNumber, setRoomNumber] = useState(room?.room_number ?? '')
  const [rentAmount, setRentAmount] = useState(room?.rent_amount?.toString() ?? '')
  const [floorNumber, setFloorNumber] = useState(room?.floor_number?.toString() ?? '')
  const [status, setStatus] = useState<Room['status']>(room?.status ?? 'vacant')
  const [description, setDescription] = useState(room?.description ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    const payload = {
      room_number: roomNumber, rent_amount: parseFloat(rentAmount),
      max_occupants: 4, floor_number: floorNumber ? parseInt(floorNumber) : null,
      status, description: description || null, building_id: buildingId,
    }
    const { error } = room
      ? await supabase.from('rooms').update(payload).eq('id', room.id)
      : await supabase.from('rooms').insert(payload)
    if (error) { setError(error.message); setLoading(false); return }
    onSaved(); onClose()
  }

  const statusOptions = [
    { key: 'vacant', label: 'Vacant', active: { background: 'rgba(100,116,139,0.85)', color: 'white' }, inactive: { background: 'rgba(255,255,255,0.35)', color: '#64748b', border: '1px solid rgba(255,255,255,0.5)' } },
    { key: 'occupied', label: 'Occupied', active: { background: 'rgba(16,185,129,0.85)', color: 'white' }, inactive: { background: 'rgba(255,255,255,0.35)', color: '#64748b', border: '1px solid rgba(255,255,255,0.5)' } },
    { key: 'maintenance', label: 'Maintenance', active: { background: 'rgba(245,158,11,0.85)', color: 'white' }, inactive: { background: 'rgba(255,255,255,0.35)', color: '#64748b', border: '1px solid rgba(255,255,255,0.5)' } },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md p-6" style={GLASS_MODAL}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[18px] font-bold text-[#1e1b4b]">{room ? 'Edit Room' : 'Add Room'}</h2>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 transition-colors" style={{ background: 'rgba(255,255,255,0.4)' }}>
            <X size={20} />
          </button>
        </div>

        {error && <div className="mb-4 p-3 rounded-xl text-[13px] text-red-600"
          style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.15)' }}>{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Room No.</label>
              <input value={roomNumber} onChange={e => setRoomNumber(e.target.value)} placeholder="101" required
                className="w-full h-11 rounded-xl px-4 text-[15px] text-[#1e1b4b] placeholder-slate-300 outline-none" style={INPUT_STYLE} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Floor</label>
              <input type="number" value={floorNumber} onChange={e => setFloorNumber(e.target.value)} placeholder="1" min="1"
                className="w-full h-11 rounded-xl px-4 text-[15px] text-[#1e1b4b] placeholder-slate-300 outline-none" style={INPUT_STYLE} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[15px]">₱</span>
                <input type="number" value={rentAmount} onChange={e => setRentAmount(e.target.value)} placeholder="4000" required min="0"
                  className="w-full h-11 rounded-xl pl-7 pr-3 text-[15px] text-[#1e1b4b] placeholder-slate-300 outline-none" style={INPUT_STYLE} />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Status</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {statusOptions.map(s => (
                <button key={s.key} type="button" onClick={() => setStatus(s.key as Room['status'])}
                  className="h-10 rounded-xl text-[13px] font-medium capitalize transition-all"
                  style={status === s.key ? s.active : s.inactive}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Description (optional)</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Corner room, with aircon"
              className="w-full h-11 rounded-xl px-4 text-[15px] text-[#1e1b4b] placeholder-slate-300 outline-none" style={INPUT_STYLE} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 h-11 rounded-xl font-medium text-[15px] text-slate-500 transition-colors"
              style={{ background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.5)' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 h-11 text-white rounded-xl font-semibold text-[15px] disabled:opacity-50 transition-colors"
              style={{ background: '#6C5CE7', boxShadow: '0 4px 12px rgba(108,92,231,0.35)' }}>
              {loading ? 'Saving…' : room ? 'Save Changes' : 'Add Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Bulk Room Modal ── */
function BulkRoomModal({ buildingId, onClose, onSaved }: {
  buildingId: string; onClose: () => void; onSaved: () => void
}) {
  const [floorNumber, setFloorNumber] = useState('1')
  const [startNumber, setStartNumber] = useState('01')
  const [roomCount, setRoomCount] = useState('5')
  const [rentAmount, setRentAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const count = Math.max(1, Math.min(50, parseInt(roomCount) || 1))
  const preview = generateRoomNumbers(startNumber, count)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!preview.length) { setError('Invalid starting room number.'); return }
    setLoading(true); setError('')
    const payload = preview.map(rn => ({
      building_id: buildingId, room_number: rn,
      floor_number: parseInt(floorNumber) || null,
      rent_amount: parseFloat(rentAmount) || 0, max_occupants: 4, status: 'vacant',
    }))
    const { error } = await supabase.from('rooms').insert(payload)
    if (error) { setError(error.message); setLoading(false); return }
    onSaved(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-[20px]" style={GLASS_MODAL}>
        <div className="flex items-center justify-between px-6 pt-6 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.35)' }}>
          <div>
            <h2 className="text-[18px] font-bold text-[#1e1b4b]">Bulk Add Rooms</h2>
            <p className="text-[13px] text-slate-400 mt-0.5">Generate multiple rooms in one click</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 transition-colors" style={{ background: 'rgba(255,255,255,0.4)' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 rounded-xl text-[13px] text-red-600" style={{ background: 'rgba(255,59,48,0.08)' }}>{error}</div>}

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Floor Number</label>
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 4].map(f => (
                <button key={f} type="button" onClick={() => setFloorNumber(String(f))}
                  className="h-10 px-4 rounded-xl text-[13px] font-medium transition-all"
                  style={floorNumber === String(f)
                    ? { background: '#6C5CE7', color: 'white', boxShadow: '0 4px 12px rgba(108,92,231,0.3)' }
                    : { background: 'rgba(255,255,255,0.35)', color: '#64748b', border: '1px solid rgba(255,255,255,0.5)' }}>
                  {floorLabel(f)}
                </button>
              ))}
              <input type="number"
                value={![1,2,3,4].includes(parseInt(floorNumber)) ? floorNumber : ''}
                onChange={e => setFloorNumber(e.target.value)}
                placeholder="Other…" min="1"
                className="h-10 w-20 rounded-xl px-3 text-[14px] text-[#1e1b4b] placeholder-slate-300 outline-none"
                style={INPUT_STYLE} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Starting Room No.</label>
              <input value={startNumber} onChange={e => setStartNumber(e.target.value)} placeholder="01" required
                className="w-full h-11 rounded-xl px-4 text-[15px] text-[#1e1b4b] placeholder-slate-300 outline-none" style={INPUT_STYLE} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Number of Rooms</label>
              <input type="number" value={roomCount} onChange={e => setRoomCount(e.target.value)} min="1" max="50" required
                className="w-full h-11 rounded-xl px-4 text-[15px] text-[#1e1b4b] outline-none" style={INPUT_STYLE} />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Room Price (same for all)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[15px]">₱</span>
              <input type="number" value={rentAmount} onChange={e => setRentAmount(e.target.value)} placeholder="4000" required min="0"
                className="w-full h-11 rounded-xl pl-8 pr-4 text-[15px] text-[#1e1b4b] placeholder-slate-300 outline-none" style={INPUT_STYLE} />
            </div>
          </div>

          {preview.length > 0 && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.45)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2.5">
                Preview — {preview.length} rooms on {floorNumber ? floorLabel(parseInt(floorNumber)) : 'Floor ?'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {preview.slice(0, 20).map(rn => (
                  <span key={rn} className="text-[#1e1b4b] text-[12px] font-medium px-2.5 py-1 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.8)' }}>
                    {rn}
                  </span>
                ))}
                {preview.length > 20 && <span className="text-[12px] text-slate-400 self-center ml-1">+{preview.length - 20} more</span>}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 h-11 rounded-xl font-medium text-[15px] text-slate-500 transition-colors"
              style={{ background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.5)' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading || !preview.length}
              className="flex-1 h-11 text-white rounded-xl font-semibold text-[15px] disabled:opacity-50 transition-colors"
              style={{ background: '#6C5CE7', boxShadow: '0 4px 12px rgba(108,92,231,0.35)' }}>
              {loading ? 'Creating…' : `Create ${preview.length} Room${preview.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Delete Room Modal ── */
function DeleteRoomModal({ room, onClose, onDeleted }: {
  room: any; onClose: () => void; onDeleted: () => void
}) {
  const activeTenants = (room.tenants ?? []).filter((t: any) => t.is_active)
  const hasRenters = activeTenants.length > 0
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setLoading(true); setError('')
    await supabase.from('payments').update({ room_id: null }).eq('room_id', room.id)
    await supabase.from('maintenance_requests').update({ room_id: null }).eq('room_id', room.id)
    await supabase.from('visitor_requests').delete().eq('room_id', room.id)
    await supabase.from('move_records').delete().eq('room_id', room.id)
    const { error } = await supabase.from('rooms').delete().eq('id', room.id)
    if (error) { setError(error.message); setLoading(false); return }
    onDeleted(); onClose()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm p-6" style={GLASS_MODAL}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-bold text-[#1e1b4b]">Delete Room {room.room_number}</h2>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 transition-colors" style={{ background: 'rgba(255,255,255,0.4)' }}>
            <X size={18} />
          </button>
        </div>

        {hasRenters ? (
          <>
            <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <p className="text-[14px] font-semibold text-amber-700 mb-1">Room is occupied</p>
              <ul className="mt-2 space-y-1">
                {activeTenants.map((t: any) => (
                  <li key={t.id} className="text-[13px] font-medium text-amber-700 flex items-center gap-1.5">
                    <Users size={12} /> {t.name}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-[13px] text-slate-500 mb-5">Transfer or remove the renter{activeTenants.length > 1 ? 's' : ''} before deleting this room.</p>
            <button onClick={onClose} className="w-full h-11 rounded-xl font-medium text-[15px] text-slate-500"
              style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.55)' }}>
              Got it
            </button>
          </>
        ) : (
          <>
            <p className="text-[14px] text-slate-500 mb-5">
              This will permanently delete <span className="font-semibold text-[#1e1b4b]">Room {room.room_number}</span>. This cannot be undone.
            </p>
            {error && <div className="mb-4 p-3 rounded-xl text-[13px] text-red-600" style={{ background: 'rgba(255,59,48,0.08)' }}>{error}</div>}
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 h-11 rounded-xl font-medium text-[15px] text-slate-500"
                style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.55)' }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={loading}
                className="flex-1 h-11 text-white rounded-xl font-medium text-[15px] disabled:opacity-50"
                style={{ background: 'rgba(239,68,68,0.85)', boxShadow: '0 4px 12px rgba(239,68,68,0.25)' }}>
                {loading ? 'Deleting…' : 'Delete Room'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Delete All Rooms Modal ── */
function DeleteAllRoomsModal({ buildingId, rooms, onClose, onDeleted }: {
  buildingId: string; rooms: any[]; onClose: () => void; onDeleted: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDeleteAll() {
    setLoading(true); setError('')
    const roomIds = rooms.map((r: any) => r.id)
    if (!roomIds.length) { onDeleted(); onClose(); return }
    await supabase.from('tenants').update({ room_id: null }).in('room_id', roomIds)
    await supabase.from('payments').update({ room_id: null }).in('room_id', roomIds)
    await supabase.from('maintenance_requests').update({ room_id: null }).in('room_id', roomIds)
    await supabase.from('visitor_requests').delete().in('room_id', roomIds)
    await supabase.from('move_records').delete().in('room_id', roomIds)
    const { error: delErr } = await supabase.from('rooms').delete().eq('building_id', buildingId)
    if (delErr) { setError(delErr.message); setLoading(false); return }
    onDeleted(); onClose()
  }

  const occupiedCount = rooms.filter((r: any) => r.status === 'occupied').length

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm p-6" style={GLASS_MODAL}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div>
            <h2 className="text-[18px] font-bold text-[#1e1b4b]">Delete All Rooms?</h2>
            <p className="text-[12px] text-slate-400">{rooms.length} room{rooms.length !== 1 ? 's' : ''} will be removed</p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 rounded-xl text-slate-400" style={{ background: 'rgba(255,255,255,0.4)' }}>
            <X size={18} />
          </button>
        </div>

        <div className="rounded-xl p-4 mb-4 space-y-1.5" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <p className="text-[12px] font-semibold text-red-700 mb-2">This will permanently remove:</p>
          {['All room records', 'Room assignments and occupancy links', 'Tenant-to-room relationships', 'Move records for these rooms'].map(item => (
            <div key={item} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
              <p className="text-[12px] text-red-700">{item}</p>
            </div>
          ))}
        </div>

        {occupiedCount > 0 && (
          <div className="rounded-xl p-3.5 mb-4 flex items-start gap-2.5"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-amber-700 font-medium">
              {occupiedCount} room{occupiedCount !== 1 ? 's are' : ' is'} currently occupied. Renters will be unlinked but their accounts will remain.
            </p>
          </div>
        )}

        <p className="text-[13px] text-slate-500 mb-5">Tenant accounts, registrations, and profiles will not be deleted. This action cannot be undone.</p>

        {error && <div className="mb-4 px-3 py-2.5 rounded-xl text-[12px] text-red-600" style={{ background: 'rgba(255,59,48,0.08)' }}>{error}</div>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl font-medium text-[15px] text-slate-500"
            style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.55)' }}>
            Cancel
          </button>
          <button onClick={handleDeleteAll} disabled={loading}
            className="flex-1 h-11 text-white rounded-xl font-semibold text-[15px] disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: loading ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.88)', boxShadow: loading ? 'none' : '0 4px 14px rgba(239,68,68,0.3)' }}>
            {loading ? (
              <><div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />Deleting…</>
            ) : (
              <><Trash2 size={15} /> Delete All Rooms</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main Page ── */
export default function Buildings() {
  const { profile } = useAuth()
  const [buildingId, setBuildingId] = useState<string | null>(null)
  const [rooms, setRooms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | undefined>()
  const [deleteRoom, setDeleteRoom] = useState<any>(null)
  const [selectedRoom, setSelectedRoom] = useState<any>(null)
  const [addRenterRoom, setAddRenterRoom] = useState<any>(null)
  const [filter, setFilter] = useState<'all' | 'vacant' | 'occupied' | 'maintenance'>('all')
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set())
  const [editMode, setEditMode] = useState(false)
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false)
  // Separate input state from debounced query to avoid filtering on every keystroke
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const searchTimer = useRef<any>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)
  const buildingIdRef = useRef<string | null>(null)

  // ── Data fetch — single query: building + rooms + tenants ──────────────────
  const fetchRooms = useCallback(async (bid: string) => {
    const { data } = await supabase
      .from('rooms')
      .select('id, room_number, floor_number, rent_amount, max_occupants, status, description, tenants(id, name, phone, move_in_date, occupants, is_active)')
      .eq('building_id', bid)
      .order('floor_number', { ascending: true, nullsFirst: false })
      .order('room_number')
    const loaded = (data ?? []) as any[]
    setRooms(loaded)
    // Keep all floor groups expanded so newly added rooms are always visible
    setExpandedFloors(new Set(loaded.map((r: any) => String(r.floor_number ?? 'none'))))
    return loaded
  }, [])

  useEffect(() => { init() }, [])

  async function init() {
    setLoading(true)
    setLoadError('')
    try {
      // Step 1: get building ID
      const { data: bldg, error: bldgErr } = await supabase
        .from('buildings')
        .select('id')
        .eq('landlord_id', profile!.id)
        .limit(1)
        .maybeSingle()

      if (bldgErr) { setLoadError(bldgErr.message); return }

      let bid: string
      if (bldg) {
        bid = bldg.id
        // Step 2: rooms + tenants
        const loaded = await fetchRooms(bid)
        const floorKeys = new Set(loaded.map((r: any) => String(r.floor_number ?? 'none')))
        setExpandedFloors(floorKeys)
      } else {
        const { data: created, error: createErr } = await supabase
          .from('buildings').insert({ name: 'My Boarding House', landlord_id: profile!.id }).select('id').single()
        if (createErr || !created) { setLoadError(createErr?.message ?? 'Could not create building'); return }
        bid = created.id
        setRooms([])
      }

      setBuildingId(bid)
      buildingIdRef.current = bid
    } catch (e: any) {
      setLoadError(e?.message ?? 'Unexpected error loading rooms')
    } finally {
      setLoading(false)
    }
  }

  // ── Single realtime channel — one listener for rooms + tenants ─────────────
  useEffect(() => {
    if (!buildingId) return
    const ch = supabase
      .channel('buildings-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `building_id=eq.${buildingId}` },
        () => fetchRooms(buildingId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tenants' },
        () => fetchRooms(buildingId))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [buildingId, fetchRooms])

  // ── Close add menu on outside click ───────────────────────────────────────
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setShowAddMenu(false)
    }
    if (showAddMenu) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [showAddMenu])

  // ── Debounced search — 200ms delay, no DB call ─────────────────────────────
  function handleSearchInput(val: string) {
    setSearchInput(val)
    clearTimeout(searchTimer.current)
    if (!val.trim()) { setSearchQuery(''); return }
    searchTimer.current = setTimeout(() => setSearchQuery(val), 200)
  }

  function clearSearch() { setSearchInput(''); setSearchQuery('') }

  async function handleRenterAdded() {
    if (!buildingId) return
    setAddRenterRoom(null)
    const newRooms = await fetchRooms(buildingId)
    if (selectedRoom) {
      const updated = newRooms.find(r => r.id === selectedRoom.id)
      if (updated) setSelectedRoom(updated)
    }
  }

  function toggleFloor(key: string) {
    setExpandedFloors(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  // ── Memoized derived state — only recomputes when deps change ──────────────
  const stats = useMemo(() => ({
    total: rooms.length,
    occupied: rooms.filter(r => r.status === 'occupied').length,
    vacant: rooms.filter(r => r.status === 'vacant').length,
    maintenance: rooms.filter(r => r.status === 'maintenance').length,
  }), [rooms])

  const filteredRooms = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return rooms.filter(r => {
      const matchesFilter = filter === 'all' || r.status === filter
      if (!q) return matchesFilter
      const matchesRoom = r.room_number?.toLowerCase().includes(q)
      const matchesStatus = statusLabel(r.status).toLowerCase().includes(q)
      const matchesDesc = r.description?.toLowerCase().includes(q)
      const matchesFloor = r.floor_number != null && floorLabel(r.floor_number).toLowerCase().includes(q)
      const matchesTenant = (r.tenants ?? []).some((t: any) => t.is_active && t.name?.toLowerCase().includes(q))
      return matchesFilter && (matchesRoom || matchesStatus || matchesDesc || matchesFloor || matchesTenant)
    })
  }, [rooms, filter, searchQuery])

  // O(n) Map-based grouping — avoids O(n²) .find() on each room
  const floorGroups = useMemo(() => {
    const map = new Map<string, { floor: number | null; label: string; rooms: any[] }>()
    for (const room of filteredRooms) {
      const f = room.floor_number ?? null
      const key = String(f ?? 'none')
      if (!map.has(key)) map.set(key, { floor: f, label: f != null ? floorLabel(f) : 'No Floor', rooms: [] })
      map.get(key)!.rooms.push(room)
    }
    return [...map.values()].sort((a, b) => {
      if (a.floor == null) return 1
      if (b.floor == null) return -1
      return a.floor - b.floor
    })
  }, [filteredRooms])

  // ── Stable callbacks for RoomCard ─────────────────────────────────────────
  const handleView = useCallback((room: any) => setSelectedRoom(room), [])
  const handleEditRoom = useCallback((room: any) => { setEditingRoom(room); setShowRoomModal(true) }, [])
  const handleDeleteRoom = useCallback((room: any) => setDeleteRoom(room), [])

  // ── Error state ────────────────────────────────────────────────────────────
  if (!loading && loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <AlertTriangle size={24} className="text-red-400" />
        </div>
        <h3 className="text-[17px] font-bold text-[#1e1b4b] mb-2">Failed to load rooms</h3>
        <p className="text-[13px] text-slate-400 mb-1 max-w-xs">
          This is usually an RLS policy issue. Run the SQL fix below in your Supabase SQL editor, then reload.
        </p>
        <p className="text-[11px] text-red-400 font-mono mb-6 max-w-sm px-2 py-2 rounded-lg"
          style={{ background: 'rgba(239,68,68,0.06)' }}>{loadError}</p>
        <div className="text-left text-[11px] font-mono p-4 rounded-xl max-w-lg w-full mb-6"
          style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', whiteSpace: 'pre-wrap' }}>
{`drop policy if exists "Landlords manage own buildings" on buildings;
create policy "Landlords manage own buildings" on buildings for all
  using (landlord_id = auth.uid())
  with check (landlord_id = auth.uid());

drop policy if exists "Landlords manage own rooms" on rooms;
create policy "Landlords manage own rooms" on rooms for all
  using (exists (
    select 1 from buildings
    where buildings.id = rooms.building_id
      and buildings.landlord_id = auth.uid()
  ))
  with check (exists (
    select 1 from buildings
    where buildings.id = rooms.building_id
      and buildings.landlord_id = auth.uid()
  ));`}
        </div>
        <button onClick={init}
          className="h-11 px-6 rounded-xl text-white font-semibold text-[14px]"
          style={{ background: '#6C5CE7', boxShadow: '0 4px 12px rgba(108,92,231,0.35)' }}>
          Try Again
        </button>
      </div>
    )
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-24 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.35)' }} />
            <div className="h-4 w-40 rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.2)' }} />
          </div>
          <div className="h-10 w-28 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.25)' }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.25)' }} />)}
        </div>
        <div className="h-11 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.2)' }} />
        <div style={{ ...GLASS, padding: 0, overflow: 'hidden' }}>
          <div className="h-14 animate-pulse" style={{ background: 'rgba(255,255,255,0.18)' }} />
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-36 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.22)' }} />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#1e1b4b]">Rooms</h1>
          <p className="text-[14px] text-slate-400 mt-0.5">Manage your room inventory</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditMode(m => !m)}
            className="flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-semibold transition-all"
            style={editMode
              ? { background: 'rgba(245,158,11,0.88)', color: 'white', boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }
              : { background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.45)', color: '#64748b' }}>
            <Pencil size={14} />
            {editMode ? 'Done Editing' : 'Edit Mode'}
          </button>

          <div className="relative" ref={addMenuRef}>
            <button
              onClick={() => setShowAddMenu(m => !m)}
              className="flex items-center gap-2 h-10 px-4 text-white rounded-xl text-[13px] font-semibold transition-colors"
              style={{ background: '#6C5CE7', boxShadow: '0 4px 12px rgba(108,92,231,0.35)' }}>
              <Plus size={15} /> Add Room
              <ChevronDown size={13} style={{ transform: showAddMenu ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
            </button>

            {showAddMenu && (
              <div className="absolute right-0 top-full mt-2 w-52 overflow-hidden z-30"
                style={{ ...GLASS_MODAL, borderRadius: 14, animation: 'slideUp 150ms ease-out' }}>
                <button
                  onClick={() => { setEditingRoom(undefined); setShowRoomModal(true); setShowAddMenu(false) }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-[14px] text-[#1e1b4b] font-medium transition-colors"
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(108,92,231,0.07)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(108,92,231,0.1)' }}>
                    <BedDouble size={14} className="text-[#6C5CE7]" />
                  </div>
                  Add Single Room
                </button>
                <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                  <button
                    onClick={() => { setShowBulkModal(true); setShowAddMenu(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-[14px] text-[#1e1b4b] font-medium transition-colors"
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(108,92,231,0.07)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(108,92,231,0.1)' }}>
                      <Layers size={14} className="text-[#6C5CE7]" />
                    </div>
                    Bulk Add Rooms
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Edit Mode banner ── */}
      {editMode && (
        <div className="mb-5 px-4 py-3 rounded-xl flex items-center gap-3 flex-wrap"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <Pencil size={14} className="text-amber-500 flex-shrink-0" />
          <p className="text-[13px] font-medium text-amber-700 flex-1 min-w-0">
            Edit Mode is on — click any room to edit it. Tap the trash icon to delete.
          </p>
          {rooms.length > 0 && (
            <button onClick={() => setShowDeleteAllModal(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-semibold flex-shrink-0 transition-all"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#dc2626' }}>
              <Trash2 size={12} /> Delete All Rooms
            </button>
          )}
        </div>
      )}

      {/* ── Stats / Filter cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        {[
          { label: 'Total', value: stats.total, icon: BedDouble, key: 'all',
            activeStyle: { background: 'rgba(108,92,231,0.15)', border: '1px solid rgba(108,92,231,0.25)' },
            iconActive: { background: '#6C5CE7', color: 'white' }, iconInactive: { background: 'rgba(108,92,231,0.1)', color: '#6C5CE7' } },
          { label: 'Occupied', value: stats.occupied, icon: Users, key: 'occupied',
            activeStyle: { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' },
            iconActive: { background: '#10b981', color: 'white' }, iconInactive: { background: 'rgba(16,185,129,0.1)', color: '#10b981' } },
          { label: 'Vacant', value: stats.vacant, icon: DoorOpen, key: 'vacant',
            activeStyle: { background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' },
            iconActive: { background: '#f59e0b', color: 'white' }, iconInactive: { background: 'rgba(245,158,11,0.1)', color: '#f59e0b' } },
          { label: 'Maintenance', value: stats.maintenance, icon: X, key: 'maintenance',
            activeStyle: { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' },
            iconActive: { background: '#ef4444', color: 'white' }, iconInactive: { background: 'rgba(239,68,68,0.08)', color: '#ef4444' } },
        ].map(({ label, value, icon: Icon, key, activeStyle, iconActive, iconInactive }) => (
          <button key={key} onClick={() => setFilter(key as typeof filter)}
            className="flex items-center gap-3 p-5 rounded-2xl text-left transition-all"
            style={filter === key ? { ...GLASS, ...activeStyle } : GLASS}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all"
              style={filter === key ? iconActive : iconInactive}>
              <Icon size={18} />
            </div>
            <div>
              <p className="text-[24px] font-bold text-[#1e1b4b] leading-none">{value}</p>
              <p className="text-[12px] text-slate-400 mt-0.5">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Search bar — input is instant, filtering is debounced ── */}
      <div className="mb-5 relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          value={searchInput}
          onChange={e => handleSearchInput(e.target.value)}
          placeholder="Search by room number, renter name, floor, or status…"
          className="w-full h-11 rounded-xl pl-10 pr-4 text-[14px] text-[#1e1b4b] placeholder-slate-300 outline-none transition-all"
          style={{
            background: 'rgba(255,255,255,0.35)',
            border: searchInput ? '1px solid rgba(108,92,231,0.3)' : '1px solid rgba(255,255,255,0.55)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            boxShadow: searchInput ? '0 0 0 3px rgba(108,92,231,0.08)' : 'none',
          }}
        />
        {searchInput && (
          <button onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 transition-colors"
            style={{ background: 'rgba(0,0,0,0.06)' }}>
            <X size={14} />
          </button>
        )}
      </div>

      {searchQuery && (
        <p className="text-[12px] text-slate-400 mb-4 px-1">
          {filteredRooms.length} room{filteredRooms.length !== 1 ? 's' : ''} matching "{searchQuery}"
        </p>
      )}

      {/* ── Empty state ── */}
      {rooms.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.45)' }}>
            <DoorOpen size={28} className="text-slate-300" />
          </div>
          <h3 className="text-[18px] font-bold text-[#1e1b4b] mb-2">No rooms yet</h3>
          <p className="text-[14px] text-slate-400 mb-6 max-w-xs">Add your first room or use Bulk Add to generate a whole floor at once.</p>
          <div className="flex gap-3">
            <button onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-2 h-11 px-5 rounded-xl text-[14px] font-medium"
              style={{ background: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.45)', color: '#64748b' }}>
              <Layers size={16} /> Bulk Add
            </button>
            <button onClick={() => { setEditingRoom(undefined); setShowRoomModal(true) }}
              className="flex items-center gap-2 h-11 px-5 text-white rounded-xl text-[14px] font-semibold"
              style={{ background: '#6C5CE7', boxShadow: '0 4px 12px rgba(108,92,231,0.35)' }}>
              <Plus size={16} /> Add Room
            </button>
          </div>
        </div>
      )}

      {rooms.length > 0 && filteredRooms.length === 0 && searchQuery && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search size={28} className="text-slate-300 mb-3" />
          <p className="text-[16px] font-semibold text-[#1e1b4b] mb-1">No rooms found</p>
          <p className="text-[13px] text-slate-400">Try a different search term or clear the filter.</p>
        </div>
      )}

      {/* ── Room display ── */}
      {floorGroups.length > 0 && (
        searchQuery.trim() ? (
          /* Flat grid when searching */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredRooms.map(room => (
              <RoomCard key={room.id} room={room} editMode={editMode}
                onView={handleView} onEdit={handleEditRoom} onDelete={handleDeleteRoom} />
            ))}
          </div>
        ) : (
          /* Collapsible floor groups */
          <div className="space-y-3">
            {floorGroups.map(group => {
              const floorKey = String(group.floor ?? 'none')
              const isExpanded = expandedFloors.has(floorKey)
              const occupiedCount = group.rooms.filter(r => r.status === 'occupied').length
              const vacantCount = group.rooms.filter(r => r.status === 'vacant').length
              const maintCount = group.rooms.filter(r => r.status === 'maintenance').length

              return (
                <div key={floorKey} style={GLASS} className="overflow-hidden">
                  <button
                    onClick={() => toggleFloor(floorKey)}
                    className="w-full flex items-center justify-between px-5 py-4 transition-colors"
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Layers size={15} className="text-slate-400" />
                        <span className="text-[15px] font-bold text-[#1e1b4b]">{group.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(108,92,231,0.1)', color: '#6C5CE7' }}>
                          {group.rooms.length} rooms
                        </span>
                        {occupiedCount > 0 && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(16,185,129,0.1)', color: '#059669' }}>
                            {occupiedCount} occupied
                          </span>
                        )}
                        {vacantCount > 0 && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706' }}>
                            {vacantCount} vacant
                          </span>
                        )}
                        {maintCount > 0 && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                            {maintCount} maint.
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronDown size={18} className="text-slate-400 flex-shrink-0 transition-transform duration-200"
                      style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.3)' }}>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-4">
                        {group.rooms.map(room => (
                          <RoomCard key={room.id} room={room} editMode={editMode}
                            onView={handleView} onEdit={handleEditRoom} onDelete={handleDeleteRoom} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ── Modals ── */}
      {selectedRoom && !editMode && (
        <RoomDetailModal
          room={selectedRoom}
          onClose={() => setSelectedRoom(null)}
          onEdit={() => { setEditingRoom(selectedRoom); setShowRoomModal(true); setSelectedRoom(null) }}
          onAddRenter={() => setAddRenterRoom(selectedRoom)}
        />
      )}

      {addRenterRoom && (
        <PickRenterModal room={addRenterRoom} landlordId={profile!.id}
          onClose={() => setAddRenterRoom(null)} onSaved={handleRenterAdded} />
      )}

      {showRoomModal && buildingId && (
        <RoomModal room={editingRoom} buildingId={buildingId}
          onClose={() => { setShowRoomModal(false); setEditingRoom(undefined) }}
          onSaved={() => fetchRooms(buildingId!)} />
      )}

      {showBulkModal && buildingId && (
        <BulkRoomModal buildingId={buildingId}
          onClose={() => setShowBulkModal(false)}
          onSaved={() => fetchRooms(buildingId!)} />
      )}

      {deleteRoom && (
        <DeleteRoomModal room={deleteRoom}
          onClose={() => setDeleteRoom(null)}
          onDeleted={() => { setDeleteRoom(null); if (buildingId) fetchRooms(buildingId) }} />
      )}

      {showDeleteAllModal && buildingId && (
        <DeleteAllRoomsModal buildingId={buildingId} rooms={rooms}
          onClose={() => setShowDeleteAllModal(false)}
          onDeleted={() => { setShowDeleteAllModal(false); setEditMode(false); fetchRooms(buildingId) }} />
      )}
    </div>
  )
}
