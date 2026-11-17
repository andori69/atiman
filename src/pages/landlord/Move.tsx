// @ts-nocheck
import { useEffect, useState, useRef } from 'react'
import { ArrowLeftRight, Upload, Plus, X, Trash2, ArrowRight, ArrowLeft } from 'lucide-react'
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

type Tenant = { id: string; name: string; room_id: string | null; room?: { room_number: string } | null; deposit_amount: number }
type Room = { id: string; room_number: string; building_name: string; status: string }
type MoveRecord = {
  id: string; move_type: string; move_date: string; condition_notes: string | null
  tenant: { name: string } | null; room: { room_number: string } | null; created_at: string
  deposit_refund: number | null; deductions: any[] | null
}

function PhotoUploadArea({ photos, onAdd, onRemove }: {
  photos: { file: File; preview: string }[]
  onAdd: (files: File[]) => void
  onRemove: (i: number) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {photos.map((p, i) => (
          <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden">
            <img src={p.preview} className="w-full h-full object-cover" alt="" />
            <button onClick={() => onRemove(i)}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center">
              <X size={11} />
            </button>
          </div>
        ))}
        <button onClick={() => ref.current?.click()}
          className="w-20 h-20 rounded-xl flex flex-col items-center justify-center gap-1 text-slate-400 transition-all"
          style={{ border: '2px dashed rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.3)' }}>
          <Upload size={16} />
          <span className="text-[10px]">Add</span>
        </button>
      </div>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden"
        onChange={e => {
          const files = Array.from(e.target.files ?? [])
          onAdd(files)
          e.target.value = ''
        }} />
    </div>
  )
}

/* ── Move-in Form ── */
function MoveInForm({ tenants, rooms, onSaved }: {
  tenants: Tenant[]; rooms: Room[]; onSaved: () => void
}) {
  const [tenantId, setTenantId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [deposit, setDeposit] = useState('')
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const vacantRooms = rooms.filter(r => r.status === 'vacant' || r.status === 'occupied')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tenantId || !roomId) return
    setLoading(true); setError(''); setSuccess(false)

    // Upload photos
    const photoUrls: string[] = []
    for (const p of photos) {
      const ext = p.file.name.split('.').pop()
      const path = `move-in-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('room-photos').upload(path, p.file, { upsert: true })
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('room-photos').getPublicUrl(path)
        photoUrls.push(publicUrl)
      }
    }

    // Update tenant
    const dep = parseFloat(deposit) || 0
    await supabase.from('tenants').update({
      room_id: roomId,
      move_in_date: date,
      deposit_amount: dep,
      is_active: true,
    }).eq('id', tenantId)

    // Mark room occupied
    await supabase.from('rooms').update({ status: 'occupied' }).eq('id', roomId)

    // Create move record
    const { error: recErr } = await supabase.from('move_records').insert({
      tenant_id: tenantId,
      room_id: roomId,
      move_type: 'in',
      move_date: date,
      condition_notes: notes || null,
      photos: photoUrls.length > 0 ? photoUrls : null,
    })

    if (recErr) { setError(recErr.message); setLoading(false); return }

    setSuccess(true); setLoading(false)
    setTenantId(''); setRoomId(''); setNotes(''); setDeposit(''); setPhotos([])
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-3 bg-red-50 rounded-xl text-sm text-red-600">{error}</div>}
      {success && <div className="p-3 rounded-xl text-sm font-medium text-green-700" style={{ background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.2)' }}>Move-in recorded successfully!</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>Renter</label>
          <select value={tenantId} onChange={e => setTenantId(e.target.value)} required
            className={INPUT} style={INPUT_STYLE}>
            <option value="">Select renter…</option>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL}>Room</label>
          <select value={roomId} onChange={e => setRoomId(e.target.value)} required
            className={INPUT} style={INPUT_STYLE}>
            <option value="">Select room…</option>
            {vacantRooms.map(r => (
              <option key={r.id} value={r.id}>Room {r.room_number} — {r.building_name} ({r.status})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <DatePicker label="Move-in Date" value={date} onChange={setDate} variant="glass" />
        </div>
        <div>
          <label className={LABEL}>Deposit (₱)</label>
          <input type="number" value={deposit} onChange={e => setDeposit(e.target.value)}
            placeholder="0" min="0" className={INPUT} style={INPUT_STYLE} />
        </div>
      </div>

      <div>
        <label className={LABEL}>Room Condition Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          placeholder="Describe the current condition of the room…"
          className="w-full rounded-xl px-4 py-3 text-[15px] text-[#1e1b4b] outline-none transition-all resize-none"
          style={INPUT_STYLE} />
      </div>

      <div>
        <label className={LABEL}>Room Photos</label>
        <PhotoUploadArea
          photos={photos}
          onAdd={files => setPhotos(prev => [...prev, ...files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))])}
          onRemove={i => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
        />
      </div>

      <button type="submit" disabled={loading || !tenantId || !roomId}
        className="flex items-center gap-2 h-11 px-6 text-white rounded-xl font-medium text-[14px] disabled:opacity-40"
        style={{ background: 'rgba(52,199,89,0.85)', boxShadow: '0 4px 12px rgba(52,199,89,0.3)' }}>
        <ArrowRight size={16} />
        {loading ? 'Recording…' : 'Record Move-in'}
      </button>
    </form>
  )
}

/* ── Move-out Form ── */
function MoveOutForm({ tenants, onSaved }: { tenants: Tenant[]; onSaved: () => void }) {
  const [tenantId, setTenantId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([])
  const [deductions, setDeductions] = useState<{ reason: string; amount: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const activeTenants = tenants.filter(t => t.room_id)
  const selectedTenant = activeTenants.find(t => t.id === tenantId)
  const deposit = selectedTenant?.deposit_amount ?? 0
  const totalDeductions = deductions.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0)
  const refund = Math.max(0, deposit - totalDeductions)

  function addDeduction() { setDeductions(prev => [...prev, { reason: '', amount: '' }]) }
  function removeDeduction(i: number) { setDeductions(prev => prev.filter((_, idx) => idx !== i)) }
  function updateDeduction(i: number, field: 'reason' | 'amount', val: string) {
    setDeductions(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: val } : d))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tenantId) return
    setLoading(true); setError(''); setSuccess(false)

    const photoUrls: string[] = []
    for (const p of photos) {
      const ext = p.file.name.split('.').pop()
      const path = `move-out-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('room-photos').upload(path, p.file, { upsert: true })
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('room-photos').getPublicUrl(path)
        photoUrls.push(publicUrl)
      }
    }

    const roomId = selectedTenant?.room_id

    // Create move record
    const { error: recErr } = await supabase.from('move_records').insert({
      tenant_id: tenantId,
      room_id: roomId,
      move_type: 'out',
      move_date: date,
      condition_notes: notes || null,
      photos: photoUrls.length > 0 ? photoUrls : null,
      deposit_refund: refund,
      deductions: deductions.filter(d => d.reason).map(d => ({ reason: d.reason, amount: parseFloat(d.amount) || 0 })),
    })
    if (recErr) { setError(recErr.message); setLoading(false); return }

    // Deactivate tenant and vacate room
    await supabase.from('tenants').update({ is_active: false, move_out_date: date }).eq('id', tenantId)
    if (roomId) {
      const { count } = await supabase.from('tenants')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', roomId).eq('is_active', true).neq('id', tenantId)
      await supabase.from('rooms').update({ status: count === 0 ? 'vacant' : 'occupied' }).eq('id', roomId)
    }

    setSuccess(true); setLoading(false)
    setTenantId(''); setNotes(''); setPhotos([]); setDeductions([])
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-3 bg-red-50 rounded-xl text-sm text-red-600">{error}</div>}
      {success && <div className="p-3 rounded-xl text-sm font-medium text-green-700" style={{ background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.2)' }}>Move-out recorded successfully!</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>Renter</label>
          <select value={tenantId} onChange={e => setTenantId(e.target.value)} required
            className={INPUT} style={INPUT_STYLE}>
            <option value="">Select renter…</option>
            {activeTenants.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} — Room {(t.room as any)?.room_number ?? '?'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <DatePicker label="Move-out Date" value={date} onChange={setDate} variant="glass" />
        </div>
      </div>

      {selectedTenant && (
        <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.6)' }}>
          <p className="text-[12px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Deposit on Record</p>
          <p className="text-[20px] font-bold text-[#1e1b4b] tabular-nums">{formatCurrency(deposit)}</p>
        </div>
      )}

      <div>
        <label className={LABEL}>Checkout Condition Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          placeholder="Describe the room condition on checkout…"
          className="w-full rounded-xl px-4 py-3 text-[15px] text-[#1e1b4b] outline-none transition-all resize-none"
          style={INPUT_STYLE} />
      </div>

      <div>
        <label className={LABEL}>Checkout Photos</label>
        <PhotoUploadArea
          photos={photos}
          onAdd={files => setPhotos(prev => [...prev, ...files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))])}
          onRemove={i => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
        />
      </div>

      {/* Deductions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={LABEL + ' mb-0'}>Deductions</label>
          <button type="button" onClick={addDeduction}
            className="flex items-center gap-1 text-[12px] font-medium transition-all"
            style={{ color: '#6C5CE7' }}>
            <Plus size={13} /> Add deduction
          </button>
        </div>
        {deductions.length === 0 && (
          <p className="text-[13px] text-slate-400 italic">No deductions added.</p>
        )}
        {deductions.map((d, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input value={d.reason} onChange={e => updateDeduction(i, 'reason', e.target.value)}
              placeholder="Reason (e.g. damaged furniture)"
              className="flex-1 h-10 rounded-xl px-3 text-[14px] text-[#1e1b4b] outline-none"
              style={INPUT_STYLE} />
            <input type="number" value={d.amount} onChange={e => updateDeduction(i, 'amount', e.target.value)}
              placeholder="₱0" min="0"
              className="w-28 h-10 rounded-xl px-3 text-[14px] text-[#1e1b4b] outline-none"
              style={INPUT_STYLE} />
            <button type="button" onClick={() => removeDeduction(i)}
              className="h-10 w-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,59,48,0.08)' }}>
              <Trash2 size={13} className="text-red-500" />
            </button>
          </div>
        ))}
      </div>

      {/* Refund summary */}
      {selectedTenant && (
        <div className="p-4 rounded-xl space-y-2" style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.6)' }}>
          <div className="flex justify-between text-[13px]">
            <span className="text-slate-400">Deposit</span>
            <span className="tabular-nums font-medium text-[#1e1b4b]">{formatCurrency(deposit)}</span>
          </div>
          {totalDeductions > 0 && (
            <div className="flex justify-between text-[13px]">
              <span className="text-slate-400">Total deductions</span>
              <span className="tabular-nums font-medium text-red-500">- {formatCurrency(totalDeductions)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.5)' }}>
            <span className="text-[13px] font-semibold text-[#1e1b4b]">Refund Amount</span>
            <span className="text-[18px] font-bold text-green-600 tabular-nums">{formatCurrency(refund)}</span>
          </div>
        </div>
      )}

      <button type="submit" disabled={loading || !tenantId}
        className="flex items-center gap-2 h-11 px-6 text-white rounded-xl font-medium text-[14px] disabled:opacity-40"
        style={{ background: 'rgba(255,59,48,0.85)', boxShadow: '0 4px 12px rgba(255,59,48,0.25)' }}>
        <ArrowLeft size={16} />
        {loading ? 'Recording…' : 'Record Move-out'}
      </button>
    </form>
  )
}

export default function Move() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<'in' | 'out'>('in')
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [history, setHistory] = useState<MoveRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { init() }, [])

  async function init() {
    setLoading(true)
    const { data: buildings } = await supabase.from('buildings').select('id, name').eq('landlord_id', profile!.id)
    const buildingIds = (buildings ?? []).map(b => b.id)
    const buildingMap = Object.fromEntries((buildings ?? []).map(b => [b.id, b.name]))

    const [{ data: roomsRaw }, { data: tenantsRaw }, { data: historyRaw }] = await Promise.all([
      supabase.from('rooms').select('id, room_number, building_id, status').in('building_id', buildingIds),
      supabase.from('tenants').select('id, name, room_id, deposit_amount, is_active, room:rooms(room_number)').eq('is_active', true),
      supabase.from('move_records')
        .select('id, move_type, move_date, condition_notes, deposit_refund, deductions, created_at, tenant:tenants(name), room:rooms(room_number)')
        .order('created_at', { ascending: false })
        .limit(30),
    ])

    setRooms((roomsRaw ?? []).map((r: any) => ({
      id: r.id, room_number: r.room_number, status: r.status,
      building_name: buildingMap[r.building_id] ?? '',
    })))
    setTenants((tenantsRaw ?? []) as Tenant[])
    setHistory((historyRaw ?? []) as MoveRecord[])
    setLoading(false)
  }

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
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1e1b4b]">Move-in / Move-out</h1>
        <p className="text-[15px] text-slate-400 mt-0.5">Record tenant arrivals and departures</p>
      </div>

      {/* Tab + Form */}
      <div style={GLASS} className="overflow-hidden">
        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
          {(['in', 'out'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 flex items-center justify-center gap-2 py-4 text-[14px] font-semibold transition-all"
              style={tab === t
                ? { color: '#6C5CE7', borderBottom: '2px solid #6C5CE7', background: 'rgba(108,92,231,0.04)' }
                : { color: '#94a3b8' }}>
              {t === 'in' ? <><ArrowRight size={15} /> Move-in</> : <><ArrowLeft size={15} /> Move-out</>}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'in'
            ? <MoveInForm tenants={tenants} rooms={rooms} onSaved={init} />
            : <MoveOutForm tenants={tenants} onSaved={init} />
          }
        </div>
      </div>

      {/* History */}
      <div style={GLASS} className="overflow-hidden">
        <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
          <h2 className="text-[15px] font-semibold text-[#1e1b4b]">History</h2>
        </div>

        {history.length === 0 ? (
          <div className="p-10 text-center">
            <ArrowLeftRight size={28} className="text-slate-300 mx-auto mb-2" />
            <p className="text-[14px] text-slate-400">No move records yet.</p>
          </div>
        ) : (
          <div>
            {history.map((rec, i) => (
              <div key={rec.id} className="flex items-start gap-4 px-6 py-4"
                style={{ borderBottom: i < history.length - 1 ? '1px solid rgba(255,255,255,0.3)' : undefined }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    background: rec.move_type === 'in' ? 'rgba(52,199,89,0.12)' : 'rgba(255,59,48,0.1)',
                  }}>
                  {rec.move_type === 'in'
                    ? <ArrowRight size={15} className="text-green-600" />
                    : <ArrowLeft size={15} className="text-red-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-semibold text-[#1e1b4b]">
                      {rec.tenant?.name ?? '—'}
                    </span>
                    <span className="text-[12px] font-semibold px-2 py-0.5 rounded-full"
                      style={rec.move_type === 'in'
                        ? { background: 'rgba(52,199,89,0.12)', color: '#15803d' }
                        : { background: 'rgba(255,59,48,0.1)', color: '#dc2626' }}>
                      Move-{rec.move_type}
                    </span>
                  </div>
                  <p className="text-[13px] text-slate-400 mt-0.5">
                    Room {rec.room?.room_number ?? '—'} · {formatDate(rec.move_date)}
                  </p>
                  {rec.condition_notes && (
                    <p className="text-[12px] text-slate-400 mt-1 italic line-clamp-1">{rec.condition_notes}</p>
                  )}
                  {rec.move_type === 'out' && rec.deposit_refund != null && (
                    <p className="text-[12px] font-medium text-green-600 mt-1">
                      Refund: {formatCurrency(rec.deposit_refund)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
