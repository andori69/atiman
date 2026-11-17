// @ts-nocheck
import { useEffect, useState } from 'react'
import {
  Plus, X, Search, User, Phone, Mail, BedDouble, Calendar, Pencil, Trash2,
  ArrowLeft, Users, Heart, CheckCircle2, ArrowLeftRight, Layers,
  CreditCard, Clock, AlertCircle, Image, ChevronLeft, ChevronRight, Bell, Download,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency, formatDate } from '@/lib/utils'
import { downloadReceiptJpg } from '@/lib/receiptGenerator'
import { DatePicker } from '@/components/ui/DatePicker'

type Room = { id: string; room_number: string; rent_amount: number; current_count: number; status: string; floor_number?: number | null }

const SOLO_DISCOUNT = 500

function calcPerPerson(roomRent: number, countAfterAdd: number): number {
  if (countAfterAdd === 1) return roomRent - SOLO_DISCOUNT
  return roomRent / countAfterAdd
}

type Tenant = {
  id: string; user_id: string | null; room_id: string | null; name: string; phone: string | null
  email: string | null; emergency_contact: string | null; emergency_phone: string | null
  move_in_date: string | null; deposit_amount: number; photo_url: string | null
  avatar_url?: string | null
  qr_code: string | null; occupants: number; is_active: boolean; created_at: string
  room?: Room | null
}

const GLASS = {
  background: 'rgba(255,255,255,0.22)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.45)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(108,92,231,0.06), 0 1px 1px rgba(255,255,255,0.5) inset',
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function avatarColor(name: string) {
  const colors = ['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500']
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) % colors.length
  return colors[hash]
}

function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

/* ── Avatar ── */
function Avatar({ tenant, size = 'md' }: { tenant: Tenant; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'w-20 h-20 text-2xl' : size === 'sm' ? 'w-9 h-9 text-sm' : 'w-12 h-12 text-base'
  const photoSrc = tenant.avatar_url ?? tenant.photo_url ?? null
  if (photoSrc) {
    return <img src={photoSrc} alt={tenant.name} className={`${dim} rounded-full object-cover flex-shrink-0`} />
  }
  return (
    <div className={`${dim} rounded-full ${avatarColor(tenant.name)} flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {initials(tenant.name)}
    </div>
  )
}

/* ── Info Row ── */
function InfoRow({ icon, label, value, accent = false }: { icon: React.ReactNode; label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-slate-400"
        style={{ background: 'rgba(255,255,255,0.5)' }}>
        {icon}
      </div>
      <div>
        <p className="text-[11px] text-slate-400">{label}</p>
        <p className={`text-[14px] font-medium ${accent ? 'text-[#6C5CE7]' : 'text-[#1e1b4b]'}`}>{value}</p>
      </div>
    </div>
  )
}

/* ── Add / Edit Tenant Modal ── */
function TenantModal({ tenant, rooms, onClose, onSaved }: {
  tenant?: Tenant; rooms: Room[]; onClose: () => void; onSaved: () => void
}) {
  const [name, setName] = useState(tenant?.name ?? '')
  const [phone, setPhone] = useState(tenant?.phone ?? '')
  const [email, setEmail] = useState(tenant?.email ?? '')
  const [emergency, setEmergency] = useState(tenant?.emergency_contact ?? '')
  const [emergencyPhone, setEmergencyPhone] = useState(tenant?.emergency_phone ?? '')
  const [roomId, setRoomId] = useState(tenant?.room_id ?? '')
  const [moveIn, setMoveIn] = useState(tenant?.move_in_date ?? new Date().toISOString().slice(0, 10))
  const [deposit, setDeposit] = useState(tenant?.deposit_amount?.toString() ?? '')
  const [occupants, setOccupants] = useState(tenant?.occupants?.toString() ?? '1')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const availableRooms = rooms.filter(r =>
    r.current_count < 4 || r.id === tenant?.room_id
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const qrCode = tenant?.qr_code ?? `ATIMAN-${crypto.randomUUID()}`

    const payload = {
      name, phone: phone || null, email: email || null,
      emergency_contact: emergency || null, emergency_phone: emergencyPhone || null,
      room_id: roomId || null, move_in_date: moveIn || null,
      deposit_amount: parseFloat(deposit) || 0,
      occupants: parseInt(occupants) || 1,
      qr_code: qrCode, is_active: true,
    }

    let err
    if (tenant) {
      const res = await supabase.from('tenants').update(payload).eq('id', tenant.id)
      err = res.error
    } else {
      const res = await supabase.from('tenants').insert(payload)
      err = res.error
    }

    if (err) { setError(err.message); setLoading(false); return }

    if (roomId) {
      await supabase.from('rooms').update({ status: 'occupied' }).eq('id', roomId)
    }
    if (tenant && tenant.room_id && tenant.room_id !== roomId) {
      const { count } = await supabase.from('tenants')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', tenant.room_id)
        .eq('is_active', true)
      await supabase.from('rooms').update({ status: count === 0 ? 'vacant' : 'occupied' }).eq('id', tenant.room_id)
    }

    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white rounded-t-2xl flex items-center justify-between px-6 py-5 border-b border-[#E8E8ED]">
          <h2 className="text-[18px] font-semibold text-[#1D1D1F]">{tenant ? 'Edit Renter' : 'Add Renter'}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#F5F5F7] text-[#6E6E73]"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <div className="p-3 bg-red-50 rounded-xl text-sm text-red-600">{error}</div>}

          {/* Profile photo — managed by renter in their Settings */}
          <div className="flex items-center gap-4 px-1">
            <div className="w-14 h-14 rounded-full bg-[#F5F5F7] overflow-hidden flex items-center justify-center flex-shrink-0">
              {(tenant?.avatar_url ?? tenant?.photo_url)
                ? <img src={tenant.avatar_url ?? tenant.photo_url} className="w-full h-full object-cover" alt="" />
                : <User size={22} className="text-[#AEAEB2]" />
              }
            </div>
            <div>
              <p className="text-[14px] font-medium text-[#1D1D1F]">Profile Photo</p>
              <p className="text-[12px] text-[#AEAEB2] mt-0.5">Managed by the renter in their settings</p>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Full Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="Juan dela Cruz"
              className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="09XX XXX XXXX"
                className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all" />
            </div>
            <div>
              <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="juan@email.com"
                className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Room</label>
              <select value={roomId} onChange={e => setRoomId(e.target.value)}
                className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all appearance-none">
                <option value="">No room</option>
                {availableRooms.map(r => {
                  const isCurrentRoom = r.id === tenant?.room_id
                  const countAfter = isCurrentRoom ? r.current_count : r.current_count + 1
                  const perPerson = calcPerPerson(r.rent_amount, countAfter)
                  const occupancyNote = r.current_count === 0 ? 'vacant' : `${r.current_count} renter${r.current_count > 1 ? 's' : ''} sharing`
                  return (
                    <option key={r.id} value={r.id}>
                      Room {r.room_number} ({occupancyNote}) — {formatCurrency(perPerson)}/person
                    </option>
                  )
                })}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Occupants</label>
              <input type="number" value={occupants} onChange={e => setOccupants(e.target.value)} min="1" max="10"
                className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <DatePicker label="Move-in Date" value={moveIn} onChange={setMoveIn} />
            </div>
            <div>
              <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">
                Deposit (₱){tenant && <span className="ml-1 normal-case tracking-normal text-[#AEAEB2]">· fixed at move-in</span>}
              </label>
              <input type="number" value={deposit} onChange={e => !tenant && setDeposit(e.target.value)} placeholder="0" min="0"
                readOnly={!!tenant}
                className={`w-full h-11 rounded-xl px-4 text-[15px] placeholder-[#AEAEB2] outline-none transition-all ${
                  tenant
                    ? 'bg-[#F5F5F7] text-[#AEAEB2] cursor-not-allowed'
                    : 'bg-[#F5F5F7] text-[#1D1D1F] focus:ring-2 focus:ring-[#0071E3] focus:bg-white'
                }`} />
            </div>
          </div>

          <div className="pt-1">
            <p className="text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-3 flex items-center gap-2">
              <Heart size={12} /> Emergency Contact
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] text-[#6E6E73] mb-1.5">Name</label>
                <input value={emergency} onChange={e => setEmergency(e.target.value)} placeholder="Parent / Guardian"
                  className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all" />
              </div>
              <div>
                <label className="block text-[12px] text-[#6E6E73] mb-1.5">Phone</label>
                <input value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} placeholder="09XX XXX XXXX"
                  className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 h-11 bg-[#F5F5F7] text-[#1D1D1F] rounded-xl font-medium text-[15px] hover:bg-[#E8E8ED] transition-colors">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 h-11 bg-[#0071E3] text-white rounded-xl font-medium text-[15px] hover:bg-[#0077ED] disabled:opacity-50 transition-colors"
              style={{ boxShadow: '0 4px 12px rgba(0,113,227,0.25)' }}>
              {loading ? 'Saving…' : tenant ? 'Save Changes' : 'Add Renter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

function formatMonthYear(mk: string) {
  const [year, month] = mk.split('-')
  return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

/* ── Transfer Room Modal ── */
function TransferRoomModal({ tenant, rooms, tenants, onClose, onSaved }: {
  tenant: Tenant; rooms: Room[]; tenants: Tenant[]; onClose: () => void; onSaved: () => void
}) {
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [roomSearch, setRoomSearch] = useState('')

  const roomOccupantNames: Record<string, string[]> = {}
  for (const t of tenants) {
    if (t.room_id && t.is_active) {
      if (!roomOccupantNames[t.room_id]) roomOccupantNames[t.room_id] = []
      roomOccupantNames[t.room_id].push(t.name)
    }
  }

  const searchLower = roomSearch.toLowerCase().trim()
  const otherRooms = rooms.filter(r => {
    if (r.id === tenant.room_id) return false
    if (!searchLower) return true
    const floorStr = r.floor_number != null ? `${r.floor_number}` : ''
    const occupantNames = roomOccupantNames[r.id] ?? []
    return (
      r.room_number.toLowerCase().includes(searchLower) ||
      floorStr.includes(searchLower) ||
      occupantNames.some(n => n.toLowerCase().includes(searchLower))
    )
  })

  async function handleTransfer() {
    if (!selectedRoomId) return
    setLoading(true)
    setError('')

    const { error: updateErr } = await supabase
      .from('tenants')
      .update({ room_id: selectedRoomId })
      .eq('id', tenant.id)
    if (updateErr) { setError(updateErr.message); setLoading(false); return }

    if (tenant.room_id) {
      const { count } = await supabase.from('tenants')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', tenant.room_id)
        .eq('is_active', true)
      await supabase.from('rooms')
        .update({ status: count === 0 ? 'vacant' : 'occupied' })
        .eq('id', tenant.room_id)
    }

    await supabase.from('rooms').update({ status: 'occupied' }).eq('id', selectedRoomId)

    onSaved()
    onClose()
  }

  function floorLabel(n: number) {
    if (n === 1) return '1st'
    if (n === 2) return '2nd'
    if (n === 3) return '3rd'
    return `${n}th`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-[#E8E8ED]">
          <div>
            <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Transfer Room</h2>
            <p className="text-[13px] text-[#6E6E73] mt-0.5">
              Moving <span className="font-medium text-[#1D1D1F]">{tenant.name}</span>
              {(tenant.room as any)?.room_number && (
                <> from Room <span className="font-medium text-[#1D1D1F]">{(tenant.room as any).room_number}</span></>
              )}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#F5F5F7] text-[#6E6E73]"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 rounded-xl text-sm text-red-600">{error}</div>}

          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AEAEB2]" />
            <input
              value={roomSearch} onChange={e => setRoomSearch(e.target.value)}
              placeholder="Search by room no., floor, or occupant name…"
              className="w-full h-10 bg-[#F5F5F7] rounded-xl pl-10 pr-4 text-[14px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all" />
          </div>

          {otherRooms.length === 0 ? (
            <div className="text-center py-8">
              <BedDouble size={32} className="text-[#AEAEB2] mx-auto mb-2" />
              <p className="text-[14px] text-[#6E6E73]">No other rooms available.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto -mr-1 pr-1">
              {otherRooms.map(room => {
                const isFull = room.current_count >= 4
                const countAfter = room.current_count + 1
                const perPerson = countAfter <= 1
                  ? room.rent_amount - 500
                  : room.rent_amount / countAfter
                const isSelected = selectedRoomId === room.id

                return (
                  <button
                    key={room.id}
                    type="button"
                    disabled={isFull}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-[#0071E3] bg-blue-50'
                        : isFull
                        ? 'border-[#E8E8ED] bg-[#FAFAFA] opacity-50 cursor-not-allowed'
                        : 'border-[#E8E8ED] hover:border-[#D2D2D7] hover:bg-[#FAFAFA]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isSelected ? 'bg-[#0071E3]' : 'bg-[#F5F5F7]'}`}>
                        <BedDouble size={14} className={isSelected ? 'text-white' : 'text-[#6E6E73]'} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[14px] font-semibold text-[#1D1D1F]">Room {room.room_number}</p>
                          {room.floor_number != null && (
                            <span className="text-[11px] font-medium bg-[#F5F5F7] text-[#6E6E73] px-1.5 py-0.5 rounded-md">
                              {floorLabel(room.floor_number)} Fl.
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-[#AEAEB2]">
                          {room.current_count === 0 ? 'Vacant' : `${room.current_count} renter${room.current_count > 1 ? 's' : ''} sharing`}
                          {isFull && ' · Full'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {!isFull && (
                        <>
                          <p className="text-[13px] font-semibold text-[#0071E3] tabular-nums">{formatCurrency(perPerson)}</p>
                          <p className="text-[11px] text-[#AEAEB2]">/person</p>
                        </>
                      )}
                      {isFull && <span className="text-[11px] font-medium bg-red-50 text-[#FF3B30] px-2 py-0.5 rounded-full">Full</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 h-11 bg-[#F5F5F7] text-[#1D1D1F] rounded-xl font-medium text-[15px] hover:bg-[#E8E8ED] transition-colors">
              Cancel
            </button>
            <button
              onClick={handleTransfer}
              disabled={loading || !selectedRoomId}
              className="flex-1 h-11 bg-[#0071E3] text-white rounded-xl font-medium text-[15px] hover:bg-[#0077ED] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              style={{ boxShadow: selectedRoomId ? '0 4px 12px rgba(0,113,227,0.25)' : undefined }}
            >
              <ArrowLeftRight size={15} />
              {loading ? 'Transferring…' : 'Transfer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Tenant Detail View ── */
function TenantDetail({ tenant, roomOccupantCount, onBack, onEdit, onDelete, onTransfer }: {
  tenant: Tenant; roomOccupantCount: number; onBack: () => void; onEdit: (t: Tenant) => void; onDelete: (id: string) => void; onTransfer: (t: Tenant) => void
}) {
  type PaymentRecord = {
    id: string; month_year: string; amount: number; room_number: string | null
    payment_method: string | null; payment_date: string | null; created_at: string; status: string
  }

  const [payHistory, setPayHistory] = useState<PaymentRecord[]>([])
  const [elecHistory, setElecHistory] = useState<{ month_year: string; share_amount: number }[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [movePhotos, setMovePhotos] = useState<string[]>([])
  const [showPhotos, setShowPhotos] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [reminderSent, setReminderSent] = useState(false)
  const [reminderLoading, setReminderLoading] = useState(false)
  const [boardingInfo, setBoardingInfo] = useState<{ name: string; address: string; phone: string } | null>(null)
  const [renterProfile, setRenterProfile] = useState<any>(null)
  const { profile } = useAuth()

  // Use live occupant count (actual active tenants in the room) — not the stale stored field
  const perPersonRent = tenant.room
    ? calcPerPerson(tenant.room.rent_amount, roomOccupantCount)
    : 0

  const dueDay = tenant.move_in_date
    ? new Date(tenant.move_in_date + 'T00:00:00').getDate()
    : null

  function getExpectedMonths(moveInDate: string): string[] {
    const months: string[] = []
    const start = new Date(moveInDate + 'T00:00:00')
    const now = new Date()
    let d = new Date(start.getFullYear(), start.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 1)
    while (d <= end) {
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      d.setMonth(d.getMonth() + 1)
    }
    return months
  }

  const paidMonths = new Set(
    payHistory.filter(p => p.status === 'confirmed' || p.status === 'verified').map(p => p.month_year)
  )
  const pendingMonths = new Set(
    payHistory.filter(p => p.status === 'pending').map(p => p.month_year)
  )
  const expectedMonths = tenant.move_in_date ? getExpectedMonths(tenant.move_in_date) : []
  // A month is overdue only if it has no confirmed AND no pending payment
  const overdueMonths = expectedMonths.filter(m => !paidMonths.has(m) && !pendingMonths.has(m))
  const overdueAmount = overdueMonths.length * perPersonRent

  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const currentMonthPending = payHistory.some(p => p.month_year === currentMonth && p.status === 'pending')

  useEffect(() => {
    setHistoryLoading(true)
    Promise.all([
      supabase.from('payments')
        .select('id, month_year, amount, payment_method, payment_date, created_at, status, room:rooms(room_number)')
        .eq('tenant_id', tenant.id)
        .order('month_year', { ascending: false }),
      supabase.from('move_records')
        .select('photos')
        .eq('tenant_id', tenant.id)
        .eq('move_type', 'in')
        .limit(1)
        .maybeSingle(),
      profile?.id
        ? supabase.from('buildings').select('name, address').eq('landlord_id', profile.id).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('electricity_shares')
        .select('share_amount, bill:electricity_bills(month_year)')
        .eq('tenant_id', tenant.id),
      tenant.user_id
        ? supabase.from('profiles').select('occupation_type, school, program, year_level, age, workplace').eq('id', tenant.user_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]).then(([{ data: payData }, { data: moveData }, { data: bldData }, { data: elecData }, { data: profData }]) => {
      setPayHistory((payData ?? []).map((p: any) => ({
        id: p.id,
        month_year: p.month_year,
        amount: p.amount,
        room_number: p.room?.room_number ?? null,
        payment_method: p.payment_method,
        payment_date: p.payment_date ?? null,
        created_at: p.created_at,
        status: p.status,
      })))
      setElecHistory((elecData ?? []).map((e: any) => ({
        month_year: e.bill?.month_year ?? null,
        share_amount: e.share_amount,
      })).filter((e: any) => e.month_year))
      setMovePhotos((moveData as any)?.photos ?? [])
      setBoardingInfo({
        name: (bldData as any)?.name ?? '',
        address: (bldData as any)?.address ?? '',
        phone: profile?.phone ?? '',
      })
      setRenterProfile(profData ?? null)
      setHistoryLoading(false)
    }).catch(() => setHistoryLoading(false))
  }, [tenant.id, profile?.id])

  function floorLabel(n: number) {
    if (n === 1) return '1st Floor'
    if (n === 2) return '2nd Floor'
    if (n === 3) return '3rd Floor'
    return `${n}th Floor`
  }

  function methodLabel(m: string | null) {
    if (!m) return null
    return ({ gcash: 'GCash', cash: 'Cash', bank_transfer: 'Bank Transfer', other: 'Other' } as any)[m.toLowerCase()] ?? m
  }

  const divider = { borderColor: 'rgba(255,255,255,0.35)' }

  async function sendReminderLocal() {
    if (!tenant.user_id || reminderLoading) return
    setReminderLoading(true)
    const hasOverdue = overdueMonths.length > 1 || (overdueMonths.length === 1 && overdueMonths[0] !== currentMonth)
    const title = hasOverdue ? 'Overdue Rent Notice' : 'Rent Reminder'
    const overdueLabels = overdueMonths.map((m: string) => formatMonthYear(m)).join(', ')
    const message = hasOverdue
      ? `You have ${overdueMonths.length} month${overdueMonths.length !== 1 ? 's' : ''} of overdue rent (${overdueLabels}) totaling ${formatCurrency(overdueAmount)}. Please settle your outstanding balance as soon as possible.`
      : `Your rent of ${formatCurrency(perPersonRent)} for ${formatMonthYear(currentMonth)} is still unpaid. Please settle your payment as soon as possible.`
    await supabase.from('notifications').insert({
      user_id: tenant.user_id, title, message,
      notification_type: hasOverdue ? 'rent_overdue' : 'rent_reminder',
      is_read: false,
    })
    setReminderLoading(false)
    setReminderSent(true)
    setTimeout(() => setReminderSent(false), 4000)
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack}
        className="flex items-center gap-2 text-[14px] font-medium transition-opacity hover:opacity-70"
        style={{ color: '#6C5CE7' }}>
        <ArrowLeft size={16} /> Back to Renters
      </button>

      {/* Main card */}
      <div style={GLASS} className="overflow-hidden">

        {/* Header */}
        <div className="p-6 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Avatar tenant={tenant} size="lg" />
            <div>
              <h2 className="text-[22px] font-semibold text-[#1e1b4b]">{tenant.name}</h2>
              {tenant.room && (
                <p className="text-[15px] font-semibold mt-0.5" style={{ color: '#6C5CE7' }}>
                  Room {(tenant.room as any).room_number}
                </p>
              )}
              <span className={`mt-2 inline-block text-[11px] font-medium px-2.5 py-1 rounded-full ${
                tenant.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {tenant.is_active ? 'Active Renter' : 'Inactive'}
              </span>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0 flex-wrap">
            {tenant.user_id && (
              <button onClick={sendReminderLocal} disabled={reminderLoading}
                className="h-9 px-4 rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-all disabled:opacity-50"
                style={reminderSent
                  ? { background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#059669' }
                  : { background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.2)', color: '#6C5CE7' }}>
                <Bell size={13} /> {reminderLoading ? 'Sending…' : reminderSent ? '✓ Sent' : 'Remind'}
              </button>
            )}
            <button onClick={() => onEdit(tenant)}
              className="h-9 px-4 rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-all"
              style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.7)', color: '#1e1b4b' }}>
              <Pencil size={13} /> Edit
            </button>
            <button onClick={() => onTransfer(tenant)}
              className="h-9 px-4 rounded-xl text-[13px] font-medium flex items-center gap-1.5 transition-all"
              style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.7)', color: '#1e1b4b' }}>
              <ArrowLeftRight size={13} /> Move Room
            </button>
            <button onClick={() => onDelete(tenant.id)}
              className="h-9 w-9 rounded-xl flex items-center justify-center transition-all"
              style={{ background: 'rgba(255,59,48,0.1)', color: '#FF3B30' }}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Info grid */}
        <div className="border-t grid sm:grid-cols-2" style={divider}>
          {/* Tenancy details */}
          <div className="p-6 space-y-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Tenancy Details</p>
            {tenant.room && (
              <InfoRow icon={<BedDouble size={14} />} label="Room" value={`Room ${(tenant.room as any).room_number}`} accent />
            )}
            {(tenant.room as any)?.floor_number != null && (
              <InfoRow icon={<Layers size={14} />} label="Floor" value={floorLabel((tenant.room as any).floor_number)} />
            )}
            {perPersonRent > 0 && (
              <InfoRow
                icon={<CreditCard size={14} />}
                label="Current Monthly Share"
                value={
                  <span className="tabular-nums">
                    {formatCurrency(perPersonRent)}
                    <span className="text-[11px] font-normal text-slate-400 ml-1.5">
                      {roomOccupantCount <= 1
                        ? '(solo · ₱500 discount)'
                        : `(÷${roomOccupantCount} occupants)`}
                    </span>
                  </span>
                }
                accent
              />
            )}
            {dueDay && (
              <InfoRow icon={<Clock size={14} />} label="Due Every" value={`${ordinal(dueDay)} of the month`} />
            )}
            {tenant.move_in_date && (
              <InfoRow icon={<Calendar size={14} />} label="Move-in Date" value={formatDate(tenant.move_in_date)} />
            )}
            {tenant.deposit_amount > 0 && (
              <InfoRow icon={<CheckCircle2 size={14} />} label="Deposit Paid" value={formatCurrency(tenant.deposit_amount)} />
            )}
          </div>

          {/* Contact info */}
          <div className="p-6 space-y-3.5 border-t sm:border-t-0 sm:border-l" style={divider}>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Contact Info</p>
            {tenant.phone && <InfoRow icon={<Phone size={14} />} label="Phone" value={tenant.phone} />}
            {tenant.email && <InfoRow icon={<Mail size={14} />} label="Email" value={tenant.email} />}
            {!tenant.phone && !tenant.email && (
              <p className="text-[13px] text-slate-400 italic">No contact info saved.</p>
            )}
            {renterProfile?.occupation_type && (
              <div className="pt-3 mt-1 space-y-3.5 border-t" style={divider}>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  {renterProfile.occupation_type === 'student' ? 'Student Info' : 'Work Info'}
                </p>
                {renterProfile.occupation_type === 'student' ? (
                  <>
                    {renterProfile.school && <InfoRow icon={<span>🏫</span>} label="School" value={renterProfile.school} />}
                    {renterProfile.program && <InfoRow icon={<span>📚</span>} label="Program" value={renterProfile.program} />}
                    {renterProfile.year_level && <InfoRow icon={<span>📅</span>} label="Year Level" value={`${renterProfile.year_level} Year`} />}
                  </>
                ) : (
                  <>
                    {renterProfile.workplace && <InfoRow icon={<span>💼</span>} label="Workplace" value={renterProfile.workplace} />}
                    {renterProfile.age && <InfoRow icon={<span>👤</span>} label="Age" value={`${renterProfile.age} yrs`} />}
                  </>
                )}
              </div>
            )}
            {(tenant.emergency_contact || tenant.emergency_phone) && (
              <div className="pt-3 mt-1 space-y-3.5 border-t" style={divider}>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Emergency Contact</p>
                {tenant.emergency_contact && <InfoRow icon={<Heart size={14} />} label="Name" value={tenant.emergency_contact} />}
                {tenant.emergency_phone && <InfoRow icon={<Phone size={14} />} label="Phone" value={tenant.emergency_phone} />}
              </div>
            )}
          </div>
        </div>

        {/* Payment status banner */}
        {!historyLoading && tenant.move_in_date && (
          <div className="border-t px-6 py-4 flex items-center justify-between gap-4 flex-wrap" style={divider}>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Payment Status</p>
              {overdueMonths.length === 0 ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-600" />
                  <span className="text-[15px] font-semibold text-green-700">All payments up to date</span>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-red-500" />
                    <span className="text-[15px] font-semibold text-red-600">
                      {overdueMonths.length} {overdueMonths.length === 1 ? 'month' : 'months'} overdue
                    </span>
                  </div>
                  <p className="text-[13px] text-slate-400 mt-0.5">
                    Total due: <span className="font-semibold text-red-500 tabular-nums">{formatCurrency(overdueAmount)}</span>
                  </p>
                </div>
              )}
            </div>
            {currentMonthPending && (
              <span className="text-[12px] font-medium px-3 py-1.5 rounded-full flex-shrink-0"
                style={{ background: 'rgba(255,149,0,0.12)', color: '#d97706' }}>
                This month: pending verification
              </span>
            )}
          </div>
        )}

        {/* Room photos */}
        <div className="border-t px-6 py-4 flex items-center justify-between" style={divider}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Room Photos</p>
          <button
            onClick={() => setShowPhotos(true)}
            className="flex items-center gap-2 h-8 px-3 rounded-xl text-[13px] font-medium transition-all"
            style={{ background: 'rgba(108,92,231,0.1)', color: '#6C5CE7', border: '1px solid rgba(108,92,231,0.2)' }}>
            <Image size={13} />
            View Move-in Photos
            {movePhotos.length > 0 && <span className="text-[11px] opacity-70">({movePhotos.length})</span>}
          </button>
        </div>

        {/* Payment history — yearly overview */}
        <div className="border-t px-6 py-5" style={divider}>
          {/* Header + year nav */}
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Payment History</p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setSelectedYear(y => y - 1)}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.7)' }}>
                <ChevronLeft size={14} className="text-slate-500" />
              </button>
              <span className="text-[14px] font-bold text-[#1e1b4b] min-w-[44px] text-center tabular-nums select-none">
                {selectedYear}
              </span>
              <button
                onClick={() => setSelectedYear(y => y + 1)}
                disabled={selectedYear >= new Date().getFullYear()}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-25"
                style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.7)' }}>
                <ChevronRight size={14} className="text-slate-500" />
              </button>
            </div>
          </div>

          {/* Year summary chips */}
          {!historyLoading && (() => {
            const currentYear = new Date().getFullYear()
            const currentMonthNum = new Date().getMonth() + 1
            const moveInYear = tenant.move_in_date ? new Date(tenant.move_in_date + 'T00:00:00').getFullYear() : null
            const moveInMonth = tenant.move_in_date ? new Date(tenant.move_in_date + 'T00:00:00').getMonth() + 1 : null

            const elecByMonth: Record<string, number> = {}
            for (const e of elecHistory) {
              if (e.month_year) elecByMonth[e.month_year] = e.share_amount
            }

            const yearMonths = MONTH_NAMES.map((monthName, idx) => {
              const monthNum = idx + 1
              const monthKey = `${selectedYear}-${String(monthNum).padStart(2, '0')}`
              const isBeforeMoveIn = moveInYear != null && (
                selectedYear < moveInYear ||
                (selectedYear === moveInYear && monthNum < moveInMonth!)
              )
              const isFuture = selectedYear > currentYear ||
                (selectedYear === currentYear && monthNum > currentMonthNum)
              const confirmed = payHistory.find(p => p.month_year === monthKey && (p.status === 'confirmed' || p.status === 'verified'))
              const pending = payHistory.find(p => p.month_year === monthKey && p.status === 'pending')
              const elecAmount = elecByMonth[monthKey] ?? null
              const isMoveIn = !isBeforeMoveIn && moveInYear === selectedYear && moveInMonth === monthNum

              let status: 'na' | 'paid' | 'pending' | 'due' | 'upcoming'
              let amount: number | null
              let method: string | null = null

              if (isBeforeMoveIn) { status = 'na'; amount = null }
              else if (isFuture) { status = 'upcoming'; amount = perPersonRent || null }
              else if (confirmed) { status = 'paid'; amount = confirmed.amount; method = confirmed.payment_method }
              else if (pending) { status = 'pending'; amount = pending.amount; method = pending.payment_method }
              else { status = 'due'; amount = perPersonRent || null }

              return { monthName, monthShort: MONTH_SHORT[idx], status, amount, method, confirmedRecord: confirmed ?? null, elecAmount, isMoveIn }
            })

            const paidCount = yearMonths.filter(m => m.status === 'paid').length
            const dueCount = yearMonths.filter(m => m.status === 'due').length

            const chipStyle: Record<string, { bg: string; color: string; label: string; cellBg: string }> = {
              paid:     { bg: 'rgba(52,199,89,0.18)',   color: '#15803d', label: 'Paid',    cellBg: 'rgba(52,199,89,0.08)'   },
              pending:  { bg: 'rgba(255,149,0,0.18)',   color: '#d97706', label: 'Pending', cellBg: 'rgba(255,149,0,0.07)'   },
              due:      { bg: 'rgba(255,59,48,0.16)',   color: '#dc2626', label: 'Due',     cellBg: 'rgba(255,59,48,0.06)'   },
              upcoming: { bg: 'rgba(174,174,178,0.12)', color: '#94a3b8', label: '—',       cellBg: 'rgba(255,255,255,0.12)' },
              na:       { bg: '', color: '#cbd5e1', label: '—',           cellBg: 'rgba(255,255,255,0.08)' },
            }

            return (
              <>
                {(paidCount > 0 || dueCount > 0) && (
                  <div className="flex gap-2 mt-2 mb-3">
                    {paidCount > 0 && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(52,199,89,0.13)', color: '#15803d' }}>
                        {paidCount} paid
                      </span>
                    )}
                    {dueCount > 0 && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,59,48,0.1)', color: '#dc2626' }}>
                        {dueCount} overdue
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-1 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                  {yearMonths.map(({ monthName, monthShort, status, amount, confirmedRecord, elecAmount, isMoveIn }) => {
                    const chip = chipStyle[status]
                    const isNa = status === 'na'

                    return (
                      <div key={monthName}
                        className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl text-center"
                        style={{
                          background: isMoveIn ? 'rgba(59,130,246,0.09)' : chip.cellBg,
                          border: isMoveIn ? '1.5px solid rgba(59,130,246,0.35)' : '1px solid rgba(255,255,255,0.3)',
                          opacity: isNa ? 0.35 : 1,
                          minHeight: 84,
                        }}>
                        <span className="text-[12px] font-bold text-[#1e1b4b] leading-none">{monthShort}</span>
                        {isMoveIn && (
                          <span className="text-[8px] font-bold uppercase tracking-wide leading-none" style={{ color: '#3b82f6' }}>move-in</span>
                        )}
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full w-full text-center leading-tight"
                          style={{ background: chip.bg, color: chip.color }}>
                          {chip.label}
                        </span>
                        {elecAmount != null && !isNa && (
                          <span className="text-[9px] font-semibold text-amber-500 leading-none" title={`Electricity: ${formatCurrency(elecAmount)}`}>
                            ⚡{formatCurrency(elecAmount)}
                          </span>
                        )}
                        {status === 'paid' && confirmedRecord && boardingInfo && (
                          <button
                            onClick={() => downloadReceiptJpg({
                              type: 'rent',
                              receiptNumber: confirmedRecord.id.split('-')[0].toUpperCase(),
                              boardingHouseName: boardingInfo.name,
                              landlordName: profile?.full_name ?? '',
                              address: boardingInfo.address,
                              phone: boardingInfo.phone,
                              renterName: tenant.name,
                              roomNumber: (tenant.room as any)?.room_number ?? '—',
                              amount: confirmedRecord.amount,
                              paymentDate: confirmedRecord.payment_date
                                ? formatDate(confirmedRecord.payment_date)
                                : formatDate(confirmedRecord.created_at?.slice(0, 10)),
                              period: `${monthName} ${selectedYear}`,
                            })}
                            className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-all mt-auto"
                            style={{ background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.18)' }}
                            title="Download Receipt">
                            <Download size={10} className="text-[#6C5CE7]" />
                          </button>
                        )}
                        {amount != null && status !== 'na' && status !== 'upcoming' && status !== 'paid' && (
                          <span className="text-[9px] tabular-nums text-slate-400 leading-none mt-auto">
                            {formatCurrency(amount)}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )
          })()}

          {historyLoading && (
            <div className="space-y-1.5 mt-3">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.4)' }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Move-in Photos Modal */}
      {showPhotos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPhotos(false)} />
          <div className="relative w-full max-w-2xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
            style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.7)' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-[18px] font-semibold text-[#1e1b4b]">Move-in Photos</h3>
                <p className="text-[13px] text-slate-400 mt-0.5">{tenant.name}</p>
              </div>
              <button onClick={() => setShowPhotos(false)}
                className="p-2 rounded-xl transition-all"
                style={{ background: 'rgba(0,0,0,0.07)' }}>
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            {movePhotos.length === 0 ? (
              <div className="text-center py-14">
                <Image size={40} className="text-slate-300 mx-auto mb-3" />
                <p className="text-[15px] font-medium text-slate-500 mb-1">No move-in photos</p>
                <p className="text-[13px] text-slate-400">Photos uploaded during move-in will appear here</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {movePhotos.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="aspect-square rounded-xl overflow-hidden block transition-all hover:scale-[1.02]"
                    style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                    <img src={url} alt={`Move-in photo ${i + 1}`} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Main Page ── */
export default function Renters() {
  const { profile } = useAuth()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingTenant, setEditingTenant] = useState<Tenant | undefined>()
  const [detailTenant, setDetailTenant] = useState<Tenant | null>(null)
  const [transferTenant, setTransferTenant] = useState<Tenant | null>(null)

  useEffect(() => { init() }, [])

  async function init(silent = false): Promise<Tenant[]> {
    if (!silent) setLoading(true)
    const { data: buildingsAll } = await supabase.from('buildings').select('id').eq('landlord_id', profile!.id)
    const buildingIds = (buildingsAll ?? []).map((b: any) => b.id)
    if (buildingIds.length > 0) {
      const { data: roomsRaw } = await supabase.from('rooms').select('id, room_number, rent_amount, floor_number, status, tenants(id, is_active)').in('building_id', buildingIds).order('room_number')
      const roomIds = (roomsRaw ?? []).map((r: any) => r.id)
      const { data: tenantsData } = roomIds.length
        ? await supabase.from('tenants').select('*, room:rooms(id, room_number, rent_amount, status, floor_number)').in('room_id', roomIds).eq('is_active', true).order('name')
        : { data: [] }
      const mappedRooms = (roomsRaw ?? []).map((r: any) => ({
        id: r.id, room_number: r.room_number, rent_amount: r.rent_amount, status: r.status,
        current_count: (r.tenants ?? []).filter((t: any) => t.is_active).length,
      }))
      setRooms(mappedRooms as Room[])

      // Enrich tenants with renter profile avatars (single source of truth)
      const raw = (tenantsData ?? []) as Tenant[]
      const userIds = [...new Set(raw.map(t => t.user_id).filter(Boolean))]
      let avatarMap: Record<string, string | null> = {}
      if (userIds.length) {
        const { data: profs } = await supabase.from('profiles').select('id, avatar_url').in('id', userIds)
        avatarMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.avatar_url ?? null]))
      }
      const withAvatars = raw.map(t => ({ ...t, avatar_url: avatarMap[t.user_id ?? ''] ?? null }))

      setTenants(withAvatars)
      if (!silent) setLoading(false)
      return withAvatars
    }
    if (!silent) setLoading(false)
    return []
  }

  async function deleteTenant(id: string) {
    if (!confirm('Remove this renter? Their records will be kept.')) return
    const tenant = tenants.find(t => t.id === id)
    await supabase.from('tenants').update({ is_active: false }).eq('id', id)
    if (tenant?.room_id) {
      const { count } = await supabase.from('tenants')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', tenant.room_id)
        .eq('is_active', true)
        .neq('id', id)
      await supabase.from('rooms').update({ status: count === 0 ? 'vacant' : 'occupied' }).eq('id', tenant.room_id)
    }
    setDetailTenant(null)
    init()
  }

  const filtered = tenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase()) ||
    t.phone?.includes(search) ||
    (t.room as any)?.room_number?.includes(search)
  )

  if (detailTenant) {
    return (
      <div>
        <TenantDetail
          tenant={detailTenant}
          roomOccupantCount={
            rooms.find(r => r.id === detailTenant.room_id)?.current_count ?? detailTenant.occupants ?? 1
          }
          onBack={() => setDetailTenant(null)}
          onEdit={t => { setEditingTenant(t); setShowModal(true) }}
          onDelete={deleteTenant}
          onTransfer={t => setTransferTenant(t)}
        />
        {showModal && (
          <TenantModal
            tenant={editingTenant}
            rooms={rooms}
            onClose={() => { setShowModal(false); setEditingTenant(undefined) }}
            onSaved={() => { init(true); setDetailTenant(null) }}
          />
        )}
        {transferTenant && (
          <TransferRoomModal
            tenant={transferTenant}
            rooms={rooms}
            tenants={tenants}
            onClose={() => setTransferTenant(null)}
            onSaved={async () => {
              const prevId = detailTenant?.id
              setTransferTenant(null)
              const fresh = await init(true)
              if (prevId) setDetailTenant(fresh.find(t => t.id === prevId) ?? null)
            }}
          />
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-36 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.4)' }} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.35)' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <>
        {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight text-[#1e1b4b]">Renters</h1>
              <p className="text-[15px] text-slate-400 mt-0.5">{tenants.length} active {tenants.length === 1 ? 'renter' : 'renters'}</p>
            </div>
            <button
              onClick={() => { setEditingTenant(undefined); setShowModal(true) }}
              className="flex items-center gap-2 h-10 px-4 text-white rounded-xl text-[14px] font-medium transition-colors"
              style={{ background: 'rgba(108,92,231,0.85)', boxShadow: '0 4px 12px rgba(108,92,231,0.3)' }}
            >
              <Plus size={16} /> Add Renter
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, phone, or room…"
              className="w-full h-11 rounded-xl pl-11 pr-4 text-[15px] text-[#1e1b4b] placeholder-slate-400 outline-none focus:ring-2 transition-all"
              style={{
                background: 'rgba(255,255,255,0.35)',
                border: '1px solid rgba(255,255,255,0.55)',
                '--tw-ring-color': 'rgba(108,92,231,0.3)',
              } as any}
            />
          </div>

          {/* Empty state */}
          {tenants.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ background: 'rgba(255,255,255,0.4)' }}>
                <Users size={28} className="text-slate-400" />
              </div>
              <h3 className="text-[18px] font-semibold text-[#1e1b4b] mb-2">No renters yet</h3>
              <p className="text-[15px] text-slate-400 mb-6 max-w-xs">Add your first renter to start tracking payments and managing room assignments.</p>
              <button onClick={() => { setEditingTenant(undefined); setShowModal(true) }}
                className="flex items-center gap-2 h-11 px-6 text-white rounded-xl text-[15px] font-medium transition-colors"
                style={{ background: 'rgba(108,92,231,0.85)', boxShadow: '0 4px 12px rgba(108,92,231,0.3)' }}>
                <Plus size={18} /> Add Renter
              </button>
            </div>
          )}

          {/* Tenant grid */}
          {filtered.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(tenant => (
                <button key={tenant.id} onClick={() => setDetailTenant(tenant)}
                  className="rounded-2xl p-5 text-left group transition-all duration-200 hover:scale-[1.01]"
                  style={{
                    background: 'rgba(255,255,255,0.28)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255,255,255,0.5)',
                    boxShadow: '0 4px 16px rgba(108,92,231,0.05)',
                  }}>
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar tenant={tenant} size="md" />
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-[#1e1b4b] truncate">{tenant.name}</p>
                      {(tenant.room as any)?.room_number
                        ? <p className="text-[13px] font-medium" style={{ color: '#6C5CE7' }}>Room {(tenant.room as any).room_number}</p>
                        : <p className="text-[13px] text-slate-400 italic">No room assigned</p>
                      }
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {tenant.phone && (
                      <div className="flex items-center gap-2 text-[13px] text-slate-500">
                        <Phone size={12} className="text-slate-400 flex-shrink-0" /> {tenant.phone}
                      </div>
                    )}
                    {tenant.email && (
                      <div className="flex items-center gap-2 text-[13px] text-slate-500 truncate">
                        <Mail size={12} className="text-slate-400 flex-shrink-0" /> {tenant.email}
                      </div>
                    )}
                    {tenant.move_in_date && (
                      <div className="flex items-center gap-2 text-[13px] text-slate-500">
                        <Calendar size={12} className="text-slate-400 flex-shrink-0" /> Since {formatDate(tenant.move_in_date)}
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    {(tenant.room as any)?.rent_amount
                      ? <p className="text-[14px] font-semibold text-[#1e1b4b] tabular-nums">
                          {formatCurrency(calcPerPerson(
                            (tenant.room as any).rent_amount,
                            rooms.find(r => r.id === tenant.room_id)?.current_count ?? tenant.occupants ?? 1
                          ))}
                          <span className="text-[11px] font-normal text-slate-400">/mo</span>
                        </p>
                      : <span />
                    }
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No search results */}
          {tenants.length > 0 && filtered.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <p className="text-[15px]">No renters match "<span className="font-medium text-[#1e1b4b]">{search}</span>"</p>
            </div>
          )}
        </>
      {showModal && (
        <TenantModal
          tenant={editingTenant}
          rooms={rooms}
          onClose={() => { setShowModal(false); setEditingTenant(undefined) }}
          onSaved={() => { init(); setDetailTenant(null) }}
        />
      )}
    </div>
  )
}
