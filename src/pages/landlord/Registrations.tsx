// @ts-nocheck
import { useEffect, useState, useMemo, useRef } from 'react'
import {
  UserCheck, X, Clock, Phone, Mail, MapPin,
  Heart, ChevronRight, GraduationCap, Briefcase,
  Search, BedDouble, Users, Check, ChevronDown, Building2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency } from '@/lib/utils'
import { DatePicker } from '@/components/ui/DatePicker'

type PendingRenter = {
  id: string; full_name: string; email: string | null; phone: string | null
  home_address: string | null; occupation_type: string | null
  school: string | null; program: string | null; year_level: string | null
  age: string | null; workplace: string | null
  parent_name: string | null; parent_phone: string | null
  status: string; created_at: string
}
type Room = {
  id: string; room_number: string; rent_amount: number
  current_count: number; max_occupants: number
  building_name: string; status: string; tenant_names: string[]
}

const SOLO_DISCOUNT = 500

function calcPerPerson(rent: number, count: number) {
  return count === 1 ? rent - SOLO_DISCOUNT : rent / count
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), days = Math.floor(h / 24)
  if (days > 0) return `${days}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return 'just now'
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

const GLASS_MODAL = {
  background: 'rgba(255,255,255,0.95)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
}

const GLASS_LIST = {
  background: 'rgba(255,255,255,0.22)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.42)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
}

// ─── Info row helper ──────────────────────────────────────────────────────────

function InfoRow({ iconBg, iconColor, icon: Icon, children }: any) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: iconBg }}>
        <Icon size={13} style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0 pt-1">{children}</div>
    </div>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({ renter, onClose, onApprove, onReject }: {
  renter: PendingRenter
  onClose: () => void
  onApprove: (r: PendingRenter) => void
  onReject: (r: PendingRenter) => void
}) {
  const isStudent = renter.occupation_type === 'student'
  const isWorking = renter.occupation_type === 'working'
  const hasAcademic = isStudent && (renter.school || renter.program || renter.year_level)
  const hasEmployment = isWorking && (renter.age || renter.workplace)
  const hasLegacyAcademic = !renter.occupation_type && (renter.school || renter.program || renter.year_level)
  const hasAddress = !!renter.home_address
  const hasEmergency = renter.parent_name || renter.parent_phone

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ ...GLASS_MODAL, boxShadow: '0 -8px 48px rgba(0,0,0,0.22)', maxHeight: '92vh' }}>

        {/* Drag handle — mobile only */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(0,0,0,0.12)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-[14px] font-bold flex-shrink-0"
            style={{ background: 'rgba(245,158,11,0.85)', boxShadow: '0 3px 10px rgba(245,158,11,0.3)' }}>
            {initials(renter.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[17px] font-semibold text-[#1D1D1F] truncate">{renter.full_name}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold">
                <Clock size={10} /> Pending
              </span>
              {isStudent && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold">
                  <GraduationCap size={10} /> Student
                </span>
              )}
              {isWorking && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[11px] font-semibold">
                  <Briefcase size={10} /> Working
                </span>
              )}
              <span className="text-[12px] text-[#AEAEB2]">{timeAgo(renter.created_at)}</span>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: 'rgba(0,0,0,0.06)' }}>
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Contact */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#AEAEB2] mb-3">Contact</p>
            <div className="space-y-2.5">
              {renter.email && (
                <InfoRow iconBg="rgba(0,113,227,0.09)" iconColor="#0071E3" icon={Mail}>
                  <p className="text-[14px] text-[#1D1D1F]">{renter.email}</p>
                </InfoRow>
              )}
              {renter.phone && (
                <InfoRow iconBg="rgba(52,199,89,0.09)" iconColor="#34C759" icon={Phone}>
                  <p className="text-[14px] text-[#1D1D1F]">{renter.phone}</p>
                </InfoRow>
              )}
              {!renter.email && !renter.phone && (
                <p className="text-[13px] text-[#AEAEB2] italic pl-1">No contact info provided</p>
              )}
            </div>
          </div>

          {/* Academic (student) */}
          {(hasAcademic || hasLegacyAcademic) && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#AEAEB2] mb-3">Academic</p>
              <InfoRow iconBg="rgba(0,113,227,0.09)" iconColor="#0071E3" icon={GraduationCap}>
                {renter.school && <p className="text-[14px] font-medium text-[#1D1D1F]">{renter.school}</p>}
                {(renter.program || renter.year_level) && (
                  <p className="text-[13px] text-[#6E6E73] mt-0.5">
                    {[renter.program, renter.year_level].filter(Boolean).join(' · ')}
                  </p>
                )}
              </InfoRow>
            </div>
          )}

          {/* Employment (working) */}
          {hasEmployment && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#AEAEB2] mb-3">Employment</p>
              <InfoRow iconBg="rgba(52,199,89,0.09)" iconColor="#34C759" icon={Briefcase}>
                {renter.workplace && <p className="text-[14px] font-medium text-[#1D1D1F]">{renter.workplace}</p>}
                {renter.age && <p className="text-[13px] text-[#6E6E73] mt-0.5">Age: {renter.age}</p>}
              </InfoRow>
            </div>
          )}

          {/* Address */}
          {hasAddress && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#AEAEB2] mb-3">Home Address</p>
              <InfoRow iconBg="rgba(255,149,0,0.09)" iconColor="#FF9500" icon={MapPin}>
                <p className="text-[14px] text-[#1D1D1F] leading-relaxed">{renter.home_address}</p>
              </InfoRow>
            </div>
          )}

          {/* Emergency contact */}
          {hasEmergency && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#AEAEB2] mb-3">Emergency Contact</p>
              <InfoRow iconBg="rgba(255,59,48,0.09)" iconColor="#FF3B30" icon={Heart}>
                {renter.parent_name && <p className="text-[14px] font-medium text-[#1D1D1F]">{renter.parent_name}</p>}
                {renter.parent_phone && <p className="text-[13px] text-[#6E6E73] mt-0.5">{renter.parent_phone}</p>}
              </InfoRow>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 flex gap-3 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
          <button
            onClick={() => onReject(renter)}
            className="flex-1 h-11 rounded-xl text-[14px] font-semibold transition-all hover:bg-red-50"
            style={{ color: '#FF3B30', border: '1.5px solid rgba(255,59,48,0.28)' }}>
            Reject
          </button>
          <button
            onClick={() => onApprove(renter)}
            className="flex-1 h-11 rounded-xl text-white text-[14px] font-semibold transition-all"
            style={{ background: '#34C759', boxShadow: '0 4px 14px rgba(52,199,89,0.32)' }}>
            Approve
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Occupancy dots ───────────────────────────────────────────────────────────

function OccupancyDots({ current, max }: { current: number; max: number }) {
  const slots = Math.max(max, current)
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: slots }).map((_, i) => (
        <div key={i} className="w-2 h-2 rounded-full transition-all"
          style={{ background: i < current ? '#6C5CE7' : 'rgba(0,0,0,0.1)' }} />
      ))}
    </div>
  )
}

// ─── Room Picker Modal ────────────────────────────────────────────────────────

function RoomPickerModal({ rooms, selected, onSelect, onClose }: {
  rooms: Room[]
  selected: Room | null
  onSelect: (r: Room | null) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80) }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return rooms
    return rooms.filter(r =>
      r.room_number.toLowerCase().includes(q) ||
      r.building_name.toLowerCase().includes(q) ||
      r.tenant_names.some(n => n.toLowerCase().includes(q))
    )
  }, [rooms, search])

  function statusChip(room: Room) {
    const slots = room.max_occupants - room.current_count
    if (room.current_count === 0)
      return { label: 'Vacant', bg: 'rgba(52,199,89,0.1)', color: '#15803d', dot: '#34C759' }
    if (slots === 1)
      return { label: '1 slot left', bg: 'rgba(245,158,11,0.1)', color: '#b45309', dot: '#F59E0B' }
    return { label: `${slots} slots`, bg: 'rgba(108,92,231,0.1)', color: '#5b21b6', dot: '#6C5CE7' }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)', maxHeight: '85vh', boxShadow: '0 -8px 48px rgba(0,0,0,0.2)' }}>

        {/* Drag handle */}
        <div className="pt-3 pb-0 flex justify-center sm:hidden">
          <div className="w-10 h-1 rounded-full bg-black/10" />
        </div>

        {/* Header + Search */}
        <div className="px-5 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[17px] font-bold text-[#1D1D1F]">Select a Room</h3>
              <p className="text-[12px] text-[#AEAEB2] mt-0.5">{rooms.length} available rooms</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-[#6E6E73]"
              style={{ background: 'rgba(0,0,0,0.06)' }}>
              <X size={16} />
            </button>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AEAEB2] pointer-events-none" />
            <input ref={inputRef} value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search room number, building, or renter name…"
              className="w-full h-10 rounded-xl pl-9 pr-4 text-[13px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none"
              style={{ background: 'rgba(0,0,0,0.05)', border: '1.5px solid transparent', transition: 'border 150ms' }}
              onFocus={e => (e.target.style.borderColor = '#6C5CE7')}
              onBlur={e => (e.target.style.borderColor = 'transparent')} />
          </div>
        </div>

        {/* Room list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">

          {/* Skip option */}
          <button
            onClick={() => { onSelect(null); onClose() }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left"
            style={{
              background: selected === null ? 'rgba(108,92,231,0.07)' : 'transparent',
              border: selected === null ? '1.5px solid rgba(108,92,231,0.25)' : '1.5px solid rgba(0,0,0,0.07)',
            }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(0,0,0,0.05)' }}>
              <BedDouble size={16} className="text-[#AEAEB2]" />
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-[#1D1D1F]">No room yet</p>
              <p className="text-[12px] text-[#AEAEB2]">Assign a room later from the Renters page</p>
            </div>
            {selected === null && <Check size={16} className="text-[#6C5CE7] flex-shrink-0" />}
          </button>

          {filtered.length === 0 && search && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Search size={22} className="text-[#AEAEB2] mb-2" />
              <p className="text-[14px] font-semibold text-[#1D1D1F]">No rooms found</p>
              <p className="text-[12px] text-[#AEAEB2] mt-0.5">Try searching by room number or renter name</p>
            </div>
          )}

          {filtered.map(room => {
            const chip = statusChip(room)
            const isSelected = selected?.id === room.id
            const afterAdd = calcPerPerson(room.rent_amount, room.current_count + 1)

            return (
              <button key={room.id}
                onClick={() => { onSelect(room); onClose() }}
                className="w-full flex items-start gap-3 px-4 py-3.5 rounded-xl transition-all text-left"
                style={{
                  background: isSelected ? 'rgba(108,92,231,0.07)' : 'rgba(0,0,0,0.02)',
                  border: isSelected ? '1.5px solid rgba(108,92,231,0.3)' : '1.5px solid rgba(0,0,0,0.07)',
                }}
                onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)' }}
                onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.02)' }}>

                {/* Icon */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: isSelected ? 'rgba(108,92,231,0.12)' : 'rgba(0,0,0,0.05)' }}>
                  <BedDouble size={17} style={{ color: isSelected ? '#6C5CE7' : '#AEAEB2' }} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-[15px] font-bold text-[#1D1D1F]">Room {room.room_number}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: chip.bg, color: chip.color }}>
                      <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle" style={{ background: chip.dot }} />
                      {chip.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mb-2">
                    <Building2 size={11} className="text-[#AEAEB2] flex-shrink-0" />
                    <p className="text-[12px] text-[#6E6E73] truncate">{room.building_name}</p>
                  </div>

                  {/* Occupancy dots */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <OccupancyDots current={room.current_count} max={room.max_occupants} />
                    <span className="text-[11px] text-[#AEAEB2]">
                      {room.current_count}/{room.max_occupants} occupied
                    </span>
                  </div>

                  {room.tenant_names.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Users size={10} className="text-[#AEAEB2] flex-shrink-0" />
                      <p className="text-[11px] text-[#AEAEB2] truncate">
                        {room.tenant_names.slice(0, 2).join(', ')}
                        {room.tenant_names.length > 2 ? ` +${room.tenant_names.length - 2}` : ''}
                      </p>
                    </div>
                  )}
                </div>

                {/* Price + check */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <p className="text-[13px] font-bold text-[#6C5CE7] tabular-nums">{formatCurrency(afterAdd)}</p>
                  <p className="text-[10px] text-[#AEAEB2]">/person</p>
                  {isSelected && <Check size={15} className="text-[#6C5CE7] mt-1" />}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Approve Modal ────────────────────────────────────────────────────────────

function ApproveModal({ renter, rooms, onClose, onDone }: {
  renter: PendingRenter; rooms: Room[]; onClose: () => void; onDone: () => void
}) {
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [moveIn, setMoveIn] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [depositPaid, setDepositPaid] = useState(false)
  const [advancePaid, setAdvancePaid] = useState(false)

  const countAfterAdd = selectedRoom ? selectedRoom.current_count + 1 : 0
  const perPerson = selectedRoom ? calcPerPerson(selectedRoom.rent_amount, countAfterAdd) : 0

  function statusChip(room: Room) {
    if (room.current_count === 0) return { label: 'Vacant', dot: '#34C759', color: '#15803d', bg: 'rgba(52,199,89,0.08)' }
    const slots = room.max_occupants - room.current_count
    if (slots === 1) return { label: '1 slot left', dot: '#F59E0B', color: '#b45309', bg: 'rgba(245,158,11,0.08)' }
    return { label: `${slots} slots`, dot: '#6C5CE7', color: '#5b21b6', bg: 'rgba(108,92,231,0.08)' }
  }

  async function handleApprove() {
    setLoading(true); setError('')

    const { data: updated, error: profileErr } = await supabase
      .from('profiles').update({ status: 'approved' }).eq('id', renter.id).select('id').maybeSingle()

    if (profileErr) { setError(profileErr.message); setLoading(false); return }
    if (!updated) {
      setError('Approval failed — missing database permission. Run the SQL policy fix in Supabase.')
      setLoading(false); return
    }

    const { data: existing } = await supabase.from('tenants').select('id').eq('user_id', renter.id).maybeSingle()

    let tenantId: string | null = existing?.id ?? null

    if (!existing) {
      const { data: newTenant, error: tenantErr } = await supabase.from('tenants').insert({
        user_id: renter.id, room_id: selectedRoom?.id ?? null, name: renter.full_name,
        phone: renter.phone, email: renter.email, move_in_date: moveIn,
        deposit_amount: perPerson, occupants: 1, is_active: true,
        qr_code: `ATIMAN-${crypto.randomUUID()}`,
      }).select('id').single()
      if (tenantErr) { setError(tenantErr.message); setLoading(false); return }
      tenantId = newTenant?.id ?? null
    } else if (selectedRoom) {
      await supabase.from('tenants').update({ room_id: selectedRoom.id, is_active: true }).eq('id', existing.id)
    }

    if (selectedRoom) {
      await supabase.from('rooms').update({ status: 'occupied' }).eq('id', selectedRoom.id)
    }

    // Record deposit + advance payments and issue receipt notification
    const today = new Date().toISOString().slice(0, 10)
    const advanceMK = moveIn.slice(0, 7)
    if (tenantId && selectedRoom && depositPaid && advancePaid) {
      await supabase.from('payments').insert([
        {
          tenant_id: tenantId, room_id: selectedRoom.id,
          amount: perPerson, month_year: advanceMK,
          payment_date: today, payment_method: 'cash',
          status: 'confirmed', notes: 'Security deposit',
        },
        {
          tenant_id: tenantId, room_id: selectedRoom.id,
          amount: perPerson, month_year: advanceMK,
          payment_date: today, payment_method: 'cash',
          status: 'confirmed', notes: 'Advance payment — first month',
        },
      ])
      await supabase.from('notifications').insert({
        user_id: renter.id,
        title: 'Payment Receipt — Move-in',
        message: `Your move-in payments have been recorded.\n\n• Security Deposit: ${formatCurrency(perPerson)}\n• 1 Month Advance: ${formatCurrency(perPerson)}\n• Total: ${formatCurrency(perPerson * 2)}\n\nRoom ${selectedRoom.room_number} — Move-in: ${moveIn}`,
        notification_type: 'payment_confirmed',
      })
    }

    await supabase.from('notifications').insert({
      user_id: renter.id,
      title: 'Account Approved!',
      message: selectedRoom
        ? `Your registration has been approved. You've been assigned to Room ${selectedRoom.room_number}.`
        : 'Your registration has been approved. Welcome to ATIMAN!',
      notification_type: 'account_approved',
    })

    onDone(); onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full sm:max-w-md flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)', maxHeight: '92vh', boxShadow: '0 -8px 48px rgba(0,0,0,0.22)' }}>

          {/* Drag handle */}
          <div className="pt-3 pb-0 flex justify-center sm:hidden">
            <div className="w-10 h-1 rounded-full bg-black/10" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
            <div>
              <h2 className="text-[18px] font-bold text-[#1D1D1F]">Approve Renter</h2>
              <p className="text-[12px] text-[#AEAEB2] mt-0.5">Assign a room and set move-in date</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-[#6E6E73]"
              style={{ background: 'rgba(0,0,0,0.06)' }}>
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Renter summary */}
            <div className="flex items-center gap-3 p-4 rounded-2xl"
              style={{ background: 'rgba(52,199,89,0.06)', border: '1px solid rgba(52,199,89,0.18)' }}>
              <div className="w-11 h-11 rounded-full bg-green-500 flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0">
                {initials(renter.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-[#1D1D1F] truncate">{renter.full_name}</p>
                <p className="text-[12px] text-[#6E6E73] truncate">{renter.email ?? renter.phone ?? 'No contact'}</p>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                style={{ background: 'rgba(52,199,89,0.12)', color: '#15803d' }}>
                Approving
              </span>
            </div>

            {error && (
              <div className="p-3 rounded-xl text-[13px] text-red-600" style={{ background: 'rgba(255,59,48,0.07)' }}>
                {error}
              </div>
            )}

            {/* Room picker trigger */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#6E6E73] mb-2">Assign Room</p>

              {selectedRoom ? (
                /* Selected room card */
                <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid rgba(108,92,231,0.3)', background: 'rgba(108,92,231,0.04)' }}>
                  <div className="flex items-start gap-3 p-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(108,92,231,0.1)' }}>
                      <BedDouble size={17} className="text-[#6C5CE7]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="text-[15px] font-bold text-[#1D1D1F]">Room {selectedRoom.room_number}</p>
                        {(() => { const c = statusChip(selectedRoom); return (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: c.bg, color: c.color }}>
                            <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle" style={{ background: c.dot }} />
                            {c.label}
                          </span>
                        )})()}
                      </div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Building2 size={11} className="text-[#AEAEB2]" />
                        <p className="text-[12px] text-[#6E6E73]">{selectedRoom.building_name}</p>
                      </div>
                      <OccupancyDots current={selectedRoom.current_count} max={selectedRoom.max_occupants} />
                    </div>
                    <button onClick={() => setShowPicker(true)}
                      className="text-[12px] font-semibold text-[#6C5CE7] px-3 py-1.5 rounded-lg flex-shrink-0 transition-colors"
                      style={{ background: 'rgba(108,92,231,0.1)' }}>
                      Change
                    </button>
                  </div>
                  {/* Rent breakdown */}
                  <div className="px-4 pb-4">
                    <div className="rounded-xl p-3 flex items-center justify-between"
                      style={{ background: 'rgba(108,92,231,0.06)', border: '1px solid rgba(108,92,231,0.1)' }}>
                      <p className="text-[12px] text-[#6E6E73]">
                        {countAfterAdd === 1 ? 'Solo · ₱500 discount applied' : `${countAfterAdd} sharing · split equally`}
                      </p>
                      <p className="text-[15px] font-bold text-[#6C5CE7] tabular-nums">{formatCurrency(perPerson)}<span className="text-[11px] font-normal text-[#AEAEB2]">/mo</span></p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Empty state trigger */
                <button onClick={() => setShowPicker(true)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl transition-all text-left"
                  style={{ background: 'rgba(0,0,0,0.03)', border: '1.5px dashed rgba(0,0,0,0.12)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#6C5CE7')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)')}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(108,92,231,0.08)' }}>
                    <BedDouble size={17} className="text-[#6C5CE7]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[14px] font-semibold text-[#1D1D1F]">Choose a room</p>
                    <p className="text-[12px] text-[#AEAEB2]">{rooms.length} available · search by room number or renter</p>
                  </div>
                  <ChevronDown size={16} className="text-[#AEAEB2] flex-shrink-0" style={{ transform: 'rotate(-90deg)' }} />
                </button>
              )}

              {!selectedRoom && (
                <p className="text-[11px] text-[#AEAEB2] mt-2 pl-1">Optional — you can assign a room later</p>
              )}
            </div>

            {/* Move-in date */}
            <DatePicker label="Move-in Date" value={moveIn} onChange={setMoveIn} />

            {/* Payment confirmation checkboxes */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#6E6E73] mb-2">Payment Confirmation</p>
              <p className="text-[12px] text-[#AEAEB2] mb-3">Both must be collected before granting access.</p>
              <div className="space-y-2">
                {[
                  { key: 'deposit', label: 'Deposit Paid', sub: selectedRoom ? `${formatCurrency(perPerson)} security deposit` : '1 month rent as security deposit', checked: depositPaid, set: setDepositPaid },
                  { key: 'advance', label: '1 Month Advance Paid', sub: selectedRoom ? `${formatCurrency(perPerson)} first month rent` : '1 month rent paid in advance', checked: advancePaid, set: setAdvancePaid },
                ].map(({ key, label, sub, checked, set }) => (
                  <label key={key}
                    className="flex items-center gap-3 p-3.5 rounded-xl cursor-pointer transition-all select-none"
                    style={{
                      background: checked ? 'rgba(52,199,89,0.06)' : 'rgba(0,0,0,0.03)',
                      border: checked ? '1px solid rgba(52,199,89,0.25)' : '1px solid rgba(0,0,0,0.08)',
                    }}>
                    <input type="checkbox" className="sr-only" checked={checked} onChange={e => set(e.target.checked)} />
                    <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        background: checked ? '#34C759' : 'rgba(0,0,0,0.08)',
                        border: checked ? 'none' : '1.5px solid rgba(0,0,0,0.18)',
                      }}>
                      {checked && <Check size={12} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#1D1D1F]">{label}</p>
                      <p className="text-[11px] text-[#6E6E73] mt-0.5">{sub}</p>
                    </div>
                    {checked && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(52,199,89,0.12)', color: '#15803d' }}>Received</span>
                    )}
                  </label>
                ))}
              </div>
              {(!depositPaid || !advancePaid) && (
                <p className="text-[11px] mt-2 pl-1" style={{ color: '#d97706' }}>
                  ⚠ Check both boxes once payments are collected to enable approval.
                </p>
              )}
              {depositPaid && advancePaid && selectedRoom && (
                <div className="mt-3 px-3 py-2.5 rounded-xl flex items-center justify-between"
                  style={{ background: 'rgba(52,199,89,0.07)', border: '1px solid rgba(52,199,89,0.2)' }}>
                  <p className="text-[12px] text-[#15803d] font-medium">Total collected</p>
                  <p className="text-[15px] font-bold tabular-nums" style={{ color: '#15803d' }}>{formatCurrency(perPerson * 2)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 flex gap-3 flex-shrink-0"
            style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
            <button onClick={onClose}
              className="flex-1 h-11 rounded-xl font-medium text-[14px] text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]"
              style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)' }}>
              Cancel
            </button>
            <button onClick={handleApprove} disabled={loading || !depositPaid || !advancePaid}
              className="flex-1 h-11 rounded-xl text-white font-semibold text-[14px] disabled:opacity-40 transition-all"
              style={{ background: '#34C759', boxShadow: depositPaid && advancePaid ? '0 4px 14px rgba(52,199,89,0.35)' : 'none' }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Approving…
                </span>
              ) : 'Approve & Grant Access'}
            </button>
          </div>
        </div>
      </div>

      {showPicker && (
        <RoomPickerModal
          rooms={rooms}
          selected={selectedRoom}
          onSelect={setSelectedRoom}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}

// ─── Reject Modal ─────────────────────────────────────────────────────────────

function RejectModal({ renter, onClose, onDone }: {
  renter: PendingRenter; onClose: () => void; onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleReject() {
    setLoading(true); setError('')

    const { error: profileErr } = await supabase
      .from('profiles').update({ status: 'rejected', rejection_reason: reason || null }).eq('id', renter.id)

    if (profileErr) { setError(profileErr.message); setLoading(false); return }

    await supabase.from('notifications').insert({
      user_id: renter.id,
      title: 'Registration Not Approved',
      message: reason || 'Your registration was not approved. Please contact your landlord.',
      notification_type: 'account_rejected',
    })

    onDone(); onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Reject Registration</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#F5F5F7] text-[#6E6E73]"><X size={20} /></button>
        </div>

        <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl mb-5">
          <div className="w-10 h-10 rounded-full bg-[#FF3B30] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
            {initials(renter.full_name)}
          </div>
          <div>
            <p className="text-[15px] font-semibold text-[#1D1D1F]">{renter.full_name}</p>
            <p className="text-[13px] text-[#6E6E73]">{renter.email}</p>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 rounded-xl text-sm text-red-600">{error}</div>}

        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#6E6E73] mb-2">Reason (optional)</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            placeholder="e.g. No available rooms at the moment…"
            rows={3}
            className="w-full bg-[#F5F5F7] rounded-xl px-4 py-3 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#FF3B30] resize-none" />
          <p className="text-[12px] text-[#AEAEB2] mt-1.5">This reason will be shown to the renter.</p>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 h-11 bg-[#F5F5F7] text-[#1D1D1F] rounded-xl font-medium text-[15px] hover:bg-[#E8E8ED] transition-colors">
            Cancel
          </button>
          <button onClick={handleReject} disabled={loading}
            className="flex-1 h-11 bg-[#FF3B30] text-white rounded-xl font-medium text-[15px] hover:bg-[#E0352C] disabled:opacity-50 transition-colors">
            {loading ? 'Rejecting…' : 'Reject Registration'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Compact registration row ─────────────────────────────────────────────────

function RegistrationRow({ renter, onClick }: { renter: PendingRenter; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-5 py-4 transition-all text-left hover:bg-white/25"
    >
      <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0"
        style={{ background: 'rgba(245,158,11,0.82)', boxShadow: '0 2px 8px rgba(245,158,11,0.28)' }}>
        {initials(renter.full_name)}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-[#1D1D1F] truncate leading-snug">{renter.full_name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Clock size={11} className="text-amber-500 flex-shrink-0" />
          <span className="text-[12px] font-medium text-amber-600">Pending</span>
          <span className="text-[12px] text-[#AEAEB2]">· {timeAgo(renter.created_at)}</span>
        </div>
        {renter.email && (
          <p className="text-[12px] text-[#AEAEB2] truncate mt-0.5">{renter.email}</p>
        )}
      </div>

      <ChevronRight size={16} className="text-[#AEAEB2] flex-shrink-0" />
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Registrations() {
  const { profile } = useAuth()
  const [pending, setPending] = useState<PendingRenter[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PendingRenter | null>(null)
  const [approving, setApproving] = useState<PendingRenter | null>(null)
  const [rejecting, setRejecting] = useState<PendingRenter | null>(null)

  useEffect(() => { init() }, [])

  async function init() {
    setLoading(true)
    const [{ data: pendingData }, { data: buildingData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('linked_landlord_id', profile!.id).eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.from('buildings').select('id').eq('landlord_id', profile!.id).limit(1).single(),
    ])

    setPending((pendingData ?? []) as PendingRenter[])

    if (buildingData) {
      const { data: roomsData } = await supabase
        .from('rooms')
        .select('id, room_number, rent_amount, max_occupants, status, tenants(id, name, is_active), buildings(name)')
        .eq('building_id', buildingData.id)
        .neq('status', 'maintenance')
        .order('room_number')

      setRooms(
        (roomsData ?? [])
          .map((r: any) => {
            const maxOcc = r.max_occupants ?? 4
            const activeTenants = (r.tenants ?? []).filter((t: any) => t.is_active)
            return {
              id: r.id,
              room_number: r.room_number,
              rent_amount: r.rent_amount,
              max_occupants: maxOcc,
              status: r.status,
              building_name: r.buildings?.name ?? 'Building',
              current_count: activeTenants.length,
              tenant_names: activeTenants.map((t: any) => t.name),
            }
          })
          .filter(r => r.current_count < r.max_occupants)
      )
    }

    setLoading(false)
  }

  function openDetail(renter: PendingRenter) {
    setSelected(renter)
  }

  function handleApprove(renter: PendingRenter) {
    setSelected(null)
    setApproving(renter)
  }

  function handleReject(renter: PendingRenter) {
    setSelected(null)
    setRejecting(renter)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-52 bg-white/35 rounded-xl animate-pulse" />
        <div className="rounded-2xl overflow-hidden animate-pulse" style={GLASS_LIST}>
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="w-11 h-11 rounded-full bg-white/50" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 bg-white/50 rounded-lg" />
                <div className="h-3 w-24 bg-white/40 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F]">Registrations</h1>
        <p className="text-[15px] text-[#6E6E73] mt-0.5">
          {pending.length > 0
            ? `${pending.length} pending ${pending.length === 1 ? 'registration' : 'registrations'} waiting for review`
            : 'No pending registrations'}
        </p>
      </div>

      {/* Empty state */}
      {pending.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4">
            <UserCheck size={28} className="text-[#34C759]" />
          </div>
          <h3 className="text-[18px] font-semibold text-[#1D1D1F] mb-2">All caught up!</h3>
          <p className="text-[15px] text-[#6E6E73] max-w-xs leading-relaxed">
            No pending renter registrations. New registrations using your landlord code will appear here.
          </p>
        </div>
      )}

      {/* Compact registration list */}
      {pending.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={GLASS_LIST}>
          {pending.map((renter, idx) => (
            <div key={renter.id}>
              {idx > 0 && (
                <div className="mx-5" style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} />
              )}
              <RegistrationRow renter={renter} onClick={() => openDetail(renter)} />
            </div>
          ))}
        </div>
      )}

      {/* Detail popup */}
      {selected && (
        <DetailModal
          renter={selected}
          onClose={() => setSelected(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      {/* Approve modal */}
      {approving && (
        <ApproveModal
          renter={approving}
          rooms={rooms}
          onClose={() => setApproving(null)}
          onDone={() => { setApproving(null); init() }}
        />
      )}

      {/* Reject modal */}
      {rejecting && (
        <RejectModal
          renter={rejecting}
          onClose={() => setRejecting(null)}
          onDone={() => { setRejecting(null); init() }}
        />
      )}
    </div>
  )
}
