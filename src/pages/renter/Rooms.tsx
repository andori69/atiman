// @ts-nocheck
import { useEffect, useState, useMemo } from 'react'
import {
  Building2, Users, X, DoorOpen, Search,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatCurrency } from '@/lib/utils'

const GLASS = {
  background: 'rgba(255,255,255,0.28)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.45)',
  borderRadius: 16,
}

const GLASS_MODAL = {
  background: 'rgba(255,255,255,0.97)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.65)',
  borderRadius: 20,
  boxShadow: '0 24px 64px rgba(100,80,200,0.18)',
}

type RoomItem = {
  id: string
  room_number: string
  rent_amount: number
  max_occupants: number
  floor_number: number | null
  status: string
  description: string | null
  building_id: string
  building_name: string
  occupied: number
}

/* ── Detail Modal ── */
function RoomDetailModal({ room, onClose, isCurrentRoom }: {
  room: RoomItem
  onClose: () => void
  isCurrentRoom: boolean
}) {
  const available = room.occupied < room.max_occupants && room.status !== 'maintenance'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden" style={GLASS_MODAL}>

        <div className="w-10 h-1 rounded-full mx-auto mt-3 sm:hidden" style={{ background: 'rgba(0,0,0,0.1)' }} />

        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-start justify-between"
          style={{
            background: available ? 'rgba(52,199,89,0.06)' : room.status === 'maintenance' ? 'rgba(174,174,178,0.1)' : 'rgba(255,59,48,0.05)',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
          }}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">{room.building_name}</p>
            <h2 className="text-[26px] font-bold text-[#1D1D1F] leading-none">Room {room.room_number}</h2>
            {room.floor_number != null && (
              <p className="text-[13px] text-slate-400 mt-1">Floor {room.floor_number}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <button onClick={onClose} className="p-2 rounded-xl flex-shrink-0"
              style={{ background: 'rgba(0,0,0,0.06)' }}>
              <X size={16} className="text-slate-400" />
            </button>
            {isCurrentRoom && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(108,92,231,0.12)', color: '#6C5CE7' }}>
                Your Room
              </span>
            )}
            {!isCurrentRoom && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                style={available
                  ? { background: 'rgba(52,199,89,0.12)', color: '#15803d' }
                  : room.status === 'maintenance'
                  ? { background: 'rgba(174,174,178,0.2)', color: '#6b7280' }
                  : { background: 'rgba(255,59,48,0.1)', color: '#dc2626' }}>
                {room.status === 'maintenance' ? 'Under Maintenance' : available ? 'Available' : 'Full'}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 px-6 py-5">
          <div className="flex flex-col items-center py-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
            <Users size={16} className="text-slate-400 mb-1.5" />
            <p className="text-[20px] font-bold text-[#1D1D1F] tabular-nums leading-none">
              {room.occupied}<span className="text-[13px] text-slate-400 font-medium">/{room.max_occupants}</span>
            </p>
            <p className="text-[10px] text-slate-400 mt-1">Occupants</p>
          </div>
          <div className="flex flex-col items-center py-3 rounded-xl col-span-2"
            style={{ background: 'rgba(108,92,231,0.05)', border: '1px solid rgba(108,92,231,0.1)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-400 mb-1">Monthly Rent</p>
            <p className="text-[22px] font-bold text-[#1D1D1F] tabular-nums leading-none">
              {room.rent_amount > 0 ? formatCurrency(room.rent_amount) : '—'}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">per month</p>
          </div>
        </div>

        {/* Description */}
        {room.description && (
          <div className="px-6 pb-5">
            <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Description</p>
              <p className="text-[13px] text-[#1D1D1F] leading-relaxed">{room.description}</p>
            </div>
          </div>
        )}

        <div className="px-6 pb-6 pt-1">
          <button onClick={onClose}
            className="w-full h-11 rounded-xl font-medium text-[15px] text-slate-500 transition-colors"
            style={{ background: 'rgba(0,0,0,0.05)' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Room Card ── */
function RoomCard({ room, onClick }: { room: RoomItem; onClick: () => void }) {
  const available = room.occupied < room.max_occupants && room.status !== 'maintenance'
  const pct = room.max_occupants > 0 ? room.occupied / room.max_occupants : 0

  return (
    <button
      onClick={onClick}
      className="flex flex-col text-left transition-all duration-200 active:scale-[0.97]"
      style={{ ...GLASS, padding: '20px 18px', cursor: 'pointer', willChange: 'transform' }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(108,92,231,0.12)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = ''
      }}
    >
      <div className="flex items-start justify-between gap-1 mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 leading-tight truncate flex-1">
          {room.building_name}
        </p>
        <span className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
          style={{ background: available ? '#34C759' : room.status === 'maintenance' ? '#AEAEB2' : '#FF3B30' }} />
      </div>

      <p className="text-[28px] font-bold text-[#1e1b4b] leading-none tabular-nums mb-1">{room.room_number}</p>
      <p className="text-[11px] text-slate-400 mb-4">
        {room.floor_number != null ? `Floor ${room.floor_number}` : 'Ground floor'}
      </p>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <Users size={10} />Occupancy
          </span>
          <span className="text-[12px] font-bold tabular-nums"
            style={{ color: available ? '#15803d' : '#dc2626' }}>
            {room.occupied}/{room.max_occupants}
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.07)' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(pct * 100, 100)}%`,
              background: pct >= 1 ? '#FF3B30' : pct >= 0.75 ? '#FF9500' : '#34C759',
            }} />
        </div>
      </div>

      <div className="flex items-center justify-between mt-auto pt-1" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <p className="text-[14px] font-bold text-[#1e1b4b] tabular-nums">
          {room.rent_amount > 0 ? formatCurrency(room.rent_amount) : '—'}
          <span className="text-[10px] font-medium text-slate-400 ml-0.5">/mo</span>
        </p>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={available
            ? { background: 'rgba(52,199,89,0.12)', color: '#15803d' }
            : room.status === 'maintenance'
            ? { background: 'rgba(174,174,178,0.12)', color: '#6b7280' }
            : { background: 'rgba(255,59,48,0.1)', color: '#dc2626' }}>
          {room.status === 'maintenance' ? 'Maintenance' : available ? 'Available' : 'Full'}
        </span>
      </div>
    </button>
  )
}

/* ── Main Page ── */
export default function AvailableRooms() {
  const { profile } = useAuth()
  const [rooms, setRooms] = useState<RoomItem[]>([])
  const [buildings, setBuildings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<RoomItem | null>(null)
  const [myRoomId, setMyRoomId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterBuilding, setFilterBuilding] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [noAccess, setNoAccess] = useState(false)

  useEffect(() => {
    if (!profile?.linked_landlord_id) { setLoading(false); return }
    init()

    const channel = supabase.channel('renter-rooms-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => init(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tenants' }, () => init(true))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile?.linked_landlord_id, profile?.id])

  async function init(silent = false) {
    if (!silent) setLoading(true)
    try {
      const landlordId = profile!.linked_landlord_id!

      // Renter's own room
      const { data: tenantRow } = await supabase
        .from('tenants')
        .select('room_id')
        .eq('user_id', profile!.id)
        .eq('is_active', true)
        .maybeSingle()
      setMyRoomId(tenantRow?.room_id ?? null)

      // Buildings
      const { data: bldgs } = await supabase
        .from('buildings').select('id, name').eq('landlord_id', landlordId).order('name')
      const bldgsArr = bldgs ?? []
      setBuildings(bldgsArr)
      if (!bldgsArr.length) { setRooms([]); return }

      const bldgIds = bldgsArr.map((b: any) => b.id)

      // Rooms — fetch all rooms in the landlord's buildings.
      // Requires the RLS policy: "Renters view rooms in their landlord buildings" on rooms.
      const { data: roomsRaw, error: roomsErr } = await supabase
        .from('rooms')
        .select('id, room_number, rent_amount, max_occupants, floor_number, status, description, building_id')
        .in('building_id', bldgIds)
        .order('room_number')
      const roomsArr = roomsRaw ?? []

      // If RLS blocks the query we get 0 rows (no error). Detect this by comparing
      // against the landlord's known buildings — if buildings loaded but rooms didn't,
      // it's a permissions gap, not a real empty state.
      if (!roomsArr.length && bldgsArr.length > 0 && !roomsErr) {
        setNoAccess(true)
        setRooms([])
        return
      }
      setNoAccess(false)
      if (!roomsArr.length) { setRooms([]); return }

      // Count active tenants per room via a security-definer RPC so renters
      // can see occupancy without RLS blocking the tenants table query.
      const countMap: Record<string, number> = {}
      const { data: occupancy } = await supabase
        .rpc('get_room_occupancy', { p_building_ids: bldgIds })
      for (const row of occupancy ?? []) countMap[row.room_id] = Number(row.occupied)

      const bldgMap: Record<string, string> = {}
      for (const b of bldgsArr) bldgMap[b.id] = b.name

      setRooms(roomsArr.map((r: any) => ({
        id: r.id,
        room_number: r.room_number,
        rent_amount: r.rent_amount ?? 0,
        max_occupants: r.max_occupants ?? 1,
        floor_number: r.floor_number ?? null,
        status: r.status ?? 'vacant',
        description: r.description ?? null,
        building_id: r.building_id,
        building_name: bldgMap[r.building_id] ?? 'Building',
        occupied: countMap[r.id] ?? 0,
      })))
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    let list = rooms
    if (filterBuilding !== 'all') list = list.filter(r => r.building_id === filterBuilding)
    if (filterStatus === 'available') list = list.filter(r => r.occupied < r.max_occupants && r.status !== 'maintenance')
    if (filterStatus === 'full') list = list.filter(r => r.occupied >= r.max_occupants)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r => r.room_number.toLowerCase().includes(q) || r.building_name.toLowerCase().includes(q))
    }
    return list
  }, [rooms, filterBuilding, filterStatus, search])

  const counts = useMemo(() => ({
    total:     rooms.length,
    available: rooms.filter(r => r.occupied < r.max_occupants && r.status !== 'maintenance').length,
    full:      rooms.filter(r => r.occupied >= r.max_occupants).length,
  }), [rooms])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.4)' }} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-44 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.35)' }} />
          ))}
        </div>
      </div>
    )
  }

  if (!profile?.linked_landlord_id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.3)' }}>
          <Building2 size={28} className="text-[#AEAEB2]" />
        </div>
        <h2 className="text-[22px] font-semibold text-[#1D1D1F] mb-2">No Landlord Linked</h2>
        <p className="text-[15px] text-[#6E6E73] max-w-xs">Your account isn't linked to a landlord yet.</p>
      </div>
    )
  }

  if (noAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.3)' }}>
          <DoorOpen size={28} className="text-[#AEAEB2]" />
        </div>
        <h2 className="text-[22px] font-semibold text-[#1D1D1F] mb-2">Rooms Not Accessible</h2>
        <p className="text-[14px] text-[#6E6E73] max-w-sm leading-relaxed">
          The database needs a permission rule so renters can browse all rooms.
          Ask your admin to run the following SQL in Supabase:
        </p>
        <div className="mt-4 px-4 py-3 rounded-xl text-left text-[11px] font-mono max-w-sm w-full"
          style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
{`drop policy if exists "Renters view rooms in their landlord buildings" on rooms;
create policy "Renters view rooms in their landlord buildings" on rooms
  for select using (
    building_id in (
      select b.id from buildings b
      join profiles p on p.linked_landlord_id = b.landlord_id
      where p.id = auth.uid()
    )
  );`}
        </div>
      </div>
    )
  }

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.3)' }}>
          <DoorOpen size={28} className="text-[#AEAEB2]" />
        </div>
        <h2 className="text-[22px] font-semibold text-[#1D1D1F] mb-2">No Rooms Yet</h2>
        <p className="text-[15px] text-[#6E6E73] max-w-xs">Your landlord hasn't added any rooms yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[26px] sm:text-[28px] font-semibold tracking-tight text-[#1D1D1F]">Available Rooms</h1>
          <p className="text-[13px] text-[#6E6E73] mt-0.5">{counts.available} available · {counts.total} total</p>
        </div>
        <button onClick={() => setShowFilters(f => !f)}
          className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-[13px] font-semibold transition-all flex-shrink-0"
          style={{
            background: showFilters ? 'rgba(108,92,231,0.12)' : 'rgba(255,255,255,0.4)',
            color: showFilters ? '#6C5CE7' : '#6E6E73',
            border: showFilters ? '1px solid rgba(108,92,231,0.2)' : '1px solid rgba(255,255,255,0.5)',
          }}>
          {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Filter
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12px] font-semibold px-3 py-1 rounded-full" style={{ background: 'rgba(52,199,89,0.1)', color: '#15803d' }}>
          {counts.available} Available
        </span>
        <span className="text-[12px] font-semibold px-3 py-1 rounded-full" style={{ background: 'rgba(255,59,48,0.08)', color: '#dc2626' }}>
          {counts.full} Full
        </span>
        <span className="text-[12px] font-semibold px-3 py-1 rounded-full" style={{ background: 'rgba(0,0,0,0.06)', color: '#6b7280' }}>
          {counts.total - counts.available - counts.full} Maintenance
        </span>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by room number or building…"
            className="w-full h-10 pl-9 pr-4 rounded-xl text-[13px] text-[#1D1D1F] outline-none focus:ring-2 focus:ring-[#6C5CE7]/30"
            style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.6)' }}
          />
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 p-3 rounded-2xl" style={GLASS}>
            <div className="flex-1 min-w-[140px]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Building</p>
              <select value={filterBuilding} onChange={e => setFilterBuilding(e.target.value)}
                className="w-full h-9 rounded-xl px-3 text-[13px] font-medium text-[#1D1D1F] outline-none appearance-none"
                style={{ background: '#F5F5F7' }}>
                <option value="all">All Buildings</option>
                {buildings.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[140px]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Status</p>
              <div className="flex gap-1.5">
                {[{ key: 'all', label: 'All' }, { key: 'available', label: 'Available' }, { key: 'full', label: 'Full' }].map(opt => (
                  <button key={opt.key} onClick={() => setFilterStatus(opt.key)}
                    className="flex-1 h-9 rounded-xl text-[12px] font-semibold transition-all"
                    style={filterStatus === opt.key ? { background: '#6C5CE7', color: '#fff' } : { background: '#F5F5F7', color: '#6E6E73' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search size={22} className="text-slate-300 mb-2.5" />
          <p className="text-[15px] font-semibold text-[#1D1D1F]">No rooms match</p>
          <p className="text-[13px] text-slate-400 mt-1">Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map(room => (
            <RoomCard key={room.id} room={room} onClick={() => setSelected(room)} />
          ))}
        </div>
      )}

      {selected && (
        <RoomDetailModal
          room={selected}
          onClose={() => setSelected(null)}
          isCurrentRoom={selected.id === myRoomId}
        />
      )}
    </div>
  )
}
