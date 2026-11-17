// @ts-nocheck
import { useEffect, useState } from 'react'
import {
  Users, Calendar, Clock, CheckCircle2, AlertTriangle, Plus, X, Minus,
  CheckCircle, Moon,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { timeAgo } from '@/lib/utils'
import { DatePicker } from '@/components/ui/DatePicker'

const GLASS = {
  background: 'rgba(255,255,255,0.28)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.45)',
  borderRadius: 16,
}

const RELATIONSHIPS = ['Friend', 'Family', 'Classmate', 'Groupmate', 'Relative']

const VISITOR_STATUS: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending:  { label: 'Pending',  color: '#d97706', bg: 'rgba(255,149,0,0.1)',  icon: Clock        },
  approved: { label: 'Approved', color: '#15803d', bg: 'rgba(52,199,89,0.1)', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: '#dc2626', bg: 'rgba(255,59,48,0.1)', icon: AlertTriangle},
}

const HOURS = ['01','02','03','04','05','06','07','08','09','10','11','12']
const MINUTES = ['00','30']

function parseTime(v: string) {
  if (!v) return { hour: '', minute: '00', ampm: 'AM' as const }
  const [h, m] = v.split(':').map(Number)
  return {
    hour: String((h % 12) || 12).padStart(2, '0'),
    minute: String(m).padStart(2, '0'),
    ampm: (h >= 12 ? 'PM' : 'AM') as 'AM' | 'PM',
  }
}

function buildTime(hour: string, minute: string, ampm: 'AM' | 'PM') {
  if (!hour) return ''
  const h = parseInt(hour)
  const h24 = ampm === 'AM' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12)
  return `${String(h24).padStart(2, '0')}:${minute}`
}

function TimeSelect({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void
}) {
  const { hour, minute, ampm } = parseTime(value)
  const hasValue = !!value

  const selBase: React.CSSProperties = {
    height: 44, borderRadius: 10, padding: '0 10px',
    fontSize: 15, fontWeight: 600, color: hasValue ? '#1D1D1F' : '#AEAEB2',
    outline: 'none', appearance: 'none' as any, cursor: 'pointer',
    background: hasValue ? 'rgba(0,113,227,0.05)' : '#F5F5F7',
    border: hasValue ? '1.5px solid rgba(0,113,227,0.25)' : '1.5px solid transparent',
    textAlign: 'center' as any,
    transition: 'all 0.15s',
  }

  return (
    <div>
      {label && (
        <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#6E6E73] mb-2">{label}</label>
      )}
      <div className="flex items-center gap-2">
        <select value={hour} onChange={e => onChange(buildTime(e.target.value, minute, ampm))}
          style={{ ...selBase, width: 68 }}>
          <option value="">HH</option>
          {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
        <span className="text-[18px] font-bold text-[#6E6E73] select-none">:</span>
        <select value={minute} onChange={e => onChange(buildTime(hour, e.target.value, ampm))}
          style={{ ...selBase, width: 68 }}>
          {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <div className="flex rounded-xl overflow-hidden flex-shrink-0"
          style={{ border: '1.5px solid #E8E8ED', height: 44 }}>
          {(['AM', 'PM'] as const).map(ap => (
            <button key={ap} type="button"
              onClick={() => onChange(buildTime(hour, minute, ap))}
              style={{
                width: 46, height: '100%', fontSize: 13, fontWeight: 700, border: 'none',
                background: ampm === ap ? '#0071E3' : '#F5F5F7',
                color: ampm === ap ? '#fff' : '#6E6E73',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
              {ap}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function fmt12(t: string) {
  if (!t) return ''
  if (t === 'overnight') return 'Overnight 🌙'
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${((h % 12) || 12)}:${String(m).padStart(2, '0')} ${ampm}`
}

function VisitorFormModal({ tenant, onClose, onSaved }: {
  tenant: any; onClose: () => void; onSaved: () => void
}) {
  const [visitorCount, setVisitorCount] = useState(1)
  const [visitDate, setVisitDate] = useState('')
  const [visitTime, setVisitTime] = useState('')
  const [visitEndTime, setVisitEndTime] = useState('')
  const [isOvernight, setIsOvernight] = useState(false)
  const [purpose, setPurpose] = useState('')
  const [relationship, setRelationship] = useState('Friend')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!visitDate) { setError('Please select a visit date.'); return }
    if (!visitTime) { setError('Please select a start time.'); return }
    if (!isOvernight && visitEndTime && visitEndTime <= visitTime) {
      setError('End time must be after start time.'); return
    }
    if (!purpose.trim()) { setError('Please enter the purpose of the visit.'); return }
    setSubmitting(true); setError('')

    const { error: insertErr } = await supabase.from('visitor_requests').insert({
      tenant_id: tenant.id,
      room_id: tenant.room_id ?? null,
      visitor_count: visitorCount,
      visit_date: visitDate,
      visit_time: visitTime,
      visit_end_time: isOvernight ? null : (visitEndTime || null),
      is_overnight: isOvernight,
      purpose: purpose.trim(),
      relationship,
      status: 'pending',
    })
    if (insertErr) {
      setError(insertErr.message || 'Failed to submit. Please try again.')
      setSubmitting(false); return
    }

    if (tenant.room?.building_id) {
      const { data: bldg } = await supabase.from('buildings').select('landlord_id').eq('id', tenant.room.building_id).maybeSingle()
      if (bldg?.landlord_id) {
        const timeRange = isOvernight
          ? `${fmt12(visitTime)} (Overnight Stay)`
          : visitEndTime ? `${fmt12(visitTime)} → ${fmt12(visitEndTime)}` : fmt12(visitTime)
        await supabase.from('notifications').insert({
          user_id: bldg.landlord_id,
          title: isOvernight ? '🌙 Overnight Visitor Notice' : 'Visitor Notice',
          message: `${tenant.name} has ${visitorCount} visitor${visitorCount !== 1 ? 's' : ''} (${relationship}) on ${visitDate} at ${timeRange}. Purpose: ${purpose.trim().slice(0, 60)}`,
          notification_type: 'visitor_request',
        })
      }
    }

    setSubmitting(false)
    setSubmitted(true)
  }

  const today = new Date().toISOString().split('T')[0]
  const LBL = 'block text-[11px] font-semibold uppercase tracking-widest text-[#6E6E73] mb-2'

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="absolute inset-0 bg-black/40"
          style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }} />
        <div className="relative w-full sm:max-w-lg flex flex-col items-center justify-center rounded-t-2xl sm:rounded-2xl px-8 py-12 text-center"
          style={{
            background: 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.6)',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.12)',
          }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
            style={{ background: 'rgba(52,199,89,0.12)' }}>
            <CheckCircle size={28} style={{ color: '#15803d' }} />
          </div>
          <h2 className="text-[20px] font-bold text-[#1D1D1F] mb-2">Notice Submitted</h2>
          <p className="text-[14px] text-[#6E6E73] max-w-xs leading-relaxed">
            Your visitor notice is pending review. Your landlord will approve or reject it shortly.
          </p>
          <button onClick={() => { onSaved(); onClose() }}
            className="mt-7 w-full h-12 rounded-xl text-white font-semibold text-[15px]"
            style={{ background: '#0071E3', boxShadow: '0 4px 14px rgba(0,113,227,0.3)' }}>
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40"
        style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        onClick={onClose} />
      <div className="relative w-full sm:max-w-lg flex flex-col rounded-t-2xl sm:rounded-2xl"
        style={{
          background: 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.6)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.12)',
          maxHeight: '92vh',
          overflowY: 'auto',
        }}>

        <div className="w-10 h-1 rounded-full mx-auto mt-3 sm:hidden flex-shrink-0"
          style={{ background: 'rgba(0,0,0,0.1)' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
          <div>
            <h2 className="text-[18px] font-bold text-[#1D1D1F]">Visitor Notice</h2>
            <p className="text-[13px] text-[#6E6E73] mt-0.5">Notify your landlord about a visitor</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: 'rgba(0,0,0,0.06)' }}>
            <X size={14} className="text-[#6E6E73]" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Number of Visitors */}
          <div>
            <label className={LBL}>Number of Visitors</label>
            <div className="flex items-center gap-3 h-11">
              <button type="button" onClick={() => setVisitorCount(c => Math.max(1, c - 1))}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0"
                style={{ background: '#F5F5F7' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#E8E8ED')}
                onMouseLeave={e => (e.currentTarget.style.background = '#F5F5F7')}>
                <Minus size={14} className="text-[#6E6E73]" />
              </button>
              <div className="flex-1 h-11 rounded-xl flex items-center justify-center"
                style={{ background: '#F5F5F7' }}>
                <span className="text-[22px] font-bold text-[#1D1D1F] tabular-nums">{visitorCount}</span>
                <span className="text-[13px] text-[#6E6E73] ml-2">{visitorCount === 1 ? 'person' : 'people'}</span>
              </div>
              <button type="button" onClick={() => setVisitorCount(c => Math.min(10, c + 1))}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0"
                style={{ background: '#F5F5F7' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#E8E8ED')}
                onMouseLeave={e => (e.currentTarget.style.background = '#F5F5F7')}>
                <Plus size={14} className="text-[#6E6E73]" />
              </button>
            </div>
          </div>

          {/* Date */}
          <DatePicker
            label="Date *"
            value={visitDate}
            onChange={setVisitDate}
            min={today}
            placeholder="Choose visit date"
          />

          {/* Start Time */}
          <TimeSelect
            label="Start Time *"
            value={visitTime}
            onChange={setVisitTime}
            placeholder="Choose start time"
          />

          {/* Overnight toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl"
            style={{ background: isOvernight ? 'rgba(99,102,241,0.08)' : '#F5F5F7', border: isOvernight ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent' }}>
            <div className="flex items-center gap-2.5">
              <Moon size={16} style={{ color: isOvernight ? '#6366f1' : '#AEAEB2' }} />
              <div>
                <p className="text-[13px] font-semibold" style={{ color: isOvernight ? '#4338ca' : '#1D1D1F' }}>Overnight Stay</p>
                <p className="text-[11px]" style={{ color: '#AEAEB2' }}>Visitor stays past midnight</p>
              </div>
            </div>
            <button type="button" onClick={() => { setIsOvernight(o => !o); if (!isOvernight) setVisitEndTime('') }}
              className="w-12 h-6 rounded-full transition-all relative flex-shrink-0"
              style={{ background: isOvernight ? '#6366f1' : '#D1D5DB' }}>
              <div className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
                style={{ left: isOvernight ? 28 : 4, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </button>
          </div>

          {/* End Time — hide when overnight */}
          {!isOvernight && (
            <TimeSelect
              label="End Time (optional)"
              value={visitEndTime}
              onChange={setVisitEndTime}
              placeholder="Choose end time"
            />
          )}

          {/* Relationship */}
          <div>
            <label className={LBL}>Relationship</label>
            <div className="flex flex-wrap gap-2">
              {RELATIONSHIPS.map(r => (
                <button key={r} type="button" onClick={() => setRelationship(r)}
                  className="h-8 px-3.5 rounded-xl text-[12px] font-semibold transition-all"
                  style={relationship === r
                    ? { background: '#0071E3', color: '#fff' }
                    : { background: '#F5F5F7', color: '#6E6E73' }}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Purpose */}
          <div>
            <label className={LBL}>Purpose *</label>
            <input
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              placeholder="e.g. Study session, family visit…"
              className="w-full h-11 rounded-xl px-4 text-[14px] text-[#1D1D1F] outline-none transition-all"
              style={{ background: '#F5F5F7', border: '1.5px solid transparent' }}
              onFocus={e => (e.currentTarget.style.border = '1.5px solid rgba(0,113,227,0.35)')}
              onBlur={e => (e.currentTarget.style.border = '1.5px solid transparent')}
            />
          </div>

          {error && <p className="text-[12px] text-red-500 font-medium">{error}</p>}

          <button onClick={handleSubmit} disabled={submitting}
            className="w-full h-12 rounded-xl text-white font-semibold text-[15px] transition-all disabled:opacity-50"
            style={{ background: '#0071E3', boxShadow: '0 4px 14px rgba(0,113,227,0.3)' }}>
            {submitting ? 'Submitting…' : 'Submit Visitor Notice'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RenterVisitors() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [tenant, setTenant] = useState<any>(null)
  const [visitorRequests, setVisitorRequests] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { init() }, [])

  async function init() {
    setLoading(true)
    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('id, name, room_id, room:rooms(room_number, building_id)')
      .eq('user_id', profile!.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!tenantRow) { setLoading(false); return }
    setTenant(tenantRow)

    const { data: vReqs } = await supabase
      .from('visitor_requests')
      .select('*')
      .eq('tenant_id', tenantRow.id)
      .order('created_at', { ascending: false })

    setVisitorRequests(vReqs ?? [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-lg mx-auto animate-pulse">
        <div className="h-8 w-40 rounded-xl" style={{ background: 'rgba(255,255,255,0.4)' }} />
        <div className="h-40 rounded-2xl" style={{ background: 'rgba(255,255,255,0.4)' }} />
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.3)' }}>
          <Users size={28} className="text-[#AEAEB2]" />
        </div>
        <h2 className="text-[22px] font-semibold text-[#1D1D1F] mb-2">Not Assigned Yet</h2>
        <p className="text-[15px] text-[#6E6E73] max-w-xs">Your landlord hasn't assigned you to a room yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F]">Visitors</h1>
          <p className="text-[13px] text-[#6E6E73] mt-0.5">
            {tenant.room?.room_number ? `Room ${tenant.room.room_number}` : 'Your Room'}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 h-10 px-4 text-white rounded-xl text-[13px] font-semibold"
          style={{ background: '#0071E3', boxShadow: '0 4px 12px rgba(0,113,227,0.25)' }}>
          <Plus size={15} /> New Notice
        </button>
      </div>

      {/* List */}
      {visitorRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
            style={{ background: 'rgba(255,255,255,0.35)' }}>
            <Users size={22} className="text-[#AEAEB2]" />
          </div>
          <p className="text-[16px] font-semibold text-[#1D1D1F]">No visitor notices</p>
          <p className="text-[13px] text-[#6E6E73] mt-1">Tap + New Notice to notify your landlord about a visitor.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visitorRequests.map(vr => {
            const sc = VISITOR_STATUS[vr.status] ?? VISITOR_STATUS.pending
            const StatusIcon = sc.icon
            const count = vr.visitor_count ?? 1
            return (
              <div key={vr.id} className="p-4" style={{ ...GLASS, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: 'rgba(0,113,227,0.08)' }}>
                      <Users size={15} style={{ color: '#0071E3' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[#1D1D1F]">
                        {count} {count === 1 ? 'visitor' : 'visitors'}
                        {vr.relationship ? ` · ${vr.relationship}` : ''}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1 text-[12px] text-[#6E6E73]">
                          <Calendar size={11} /> {new Date(vr.visit_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span className="text-[12px] text-[#6E6E73]">
                          · {vr.is_overnight
                            ? `${fmt12(vr.visit_time)} → Overnight 🌙`
                            : vr.visit_end_time
                            ? `${fmt12(vr.visit_time)} → ${fmt12(vr.visit_end_time)}`
                            : fmt12(vr.visit_time)}
                        </span>
                      </div>
                      <p className="text-[12px] text-[#6E6E73] mt-0.5">{vr.purpose}</p>
                      <p className="text-[11px] text-[#AEAEB2] mt-1">{timeAgo(vr.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full flex-shrink-0 mt-0.5"
                    style={{ background: sc.bg }}>
                    <StatusIcon size={10} style={{ color: sc.color }} />
                    <span className="text-[10px] font-bold" style={{ color: sc.color }}>{sc.label}</span>
                  </div>
                </div>
                {vr.status === 'approved' && (
                  <div className="mt-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(52,199,89,0.07)', border: '1px solid rgba(52,199,89,0.18)' }}>
                    <p className="text-[12px] font-medium text-green-700">
                      Visitor approved. Please keep noise levels minimal and follow dorm rules.
                    </p>
                  </div>
                )}
                {vr.status === 'rejected' && vr.rejection_reason && (
                  <div className="mt-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,59,48,0.07)', border: '1px solid rgba(255,59,48,0.15)' }}>
                    <p className="text-[12px] text-red-600">Reason: {vr.rejection_reason}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <VisitorFormModal tenant={tenant} onClose={() => setShowForm(false)} onSaved={init} />
      )}
    </div>
  )
}
