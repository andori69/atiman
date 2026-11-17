// @ts-nocheck
/**
 * REQUIRED — run once in Supabase SQL Editor:
 *
 * -- Add repair_photos column for landlord completion photos
 * alter table maintenance_requests add column if not exists repair_photos text[];
 *
 * -- maintenance_logs (if not already created)
 * create table if not exists maintenance_logs (
 *   id uuid primary key default gen_random_uuid(),
 *   request_id uuid references maintenance_requests(id) on delete cascade not null,
 *   event_type text not null,
 *   message text not null,
 *   actor text default 'system',
 *   created_at timestamptz default now()
 * );
 * alter table maintenance_logs enable row level security;
 * create policy "Authenticated full access" on maintenance_logs
 *   for all using (auth.uid() is not null);
 *
 * -- In Supabase Dashboard > Storage: set maintenance-photos bucket to Public
 */
import { useEffect, useState, useRef } from 'react'
import {
  Wrench, Zap, Droplets, Hammer, Sparkles, Building2,
  CheckCircle2, Clock, Plus, X, FileImage, CheckCircle,
  Bell, RefreshCw, ChevronLeft, ChevronRight, ZoomIn, ImageOff,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { timeAgo } from '@/lib/utils'

const MAX_PHOTOS = 4

const GLASS = {
  background: 'rgba(255,255,255,0.28)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.45)',
  borderRadius: 16,
}

const CATEGORIES = [
  { value: 'repair',     label: 'Maintenance', icon: Hammer,   color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  { value: 'electrical', label: 'Electrical',  icon: Zap,      color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
  { value: 'plumbing',   label: 'Plumbing',    icon: Droplets, color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)'  },
  { value: 'cleaning',   label: 'Cleaning',    icon: Sparkles, color: '#10b981', bg: 'rgba(16,185,129,0.1)'  },
]

const URGENCIES = [
  { value: 'low',    label: 'Low',    color: '#0369a1', bg: 'rgba(90,200,250,0.12)'  },
  { value: 'medium', label: 'Medium', color: '#d97706', bg: 'rgba(255,149,0,0.12)'   },
  { value: 'high',   label: 'High',   color: '#dc2626', bg: 'rgba(255,59,48,0.12)'   },
]

const MAINT_STATUS: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending:     { label: 'Pending',     color: '#d97706', bg: 'rgba(255,149,0,0.1)',  icon: Clock        },
  in_progress: { label: 'In Progress', color: '#0071E3', bg: 'rgba(0,113,227,0.1)', icon: Wrench       },
  resolved:    { label: 'Resolved',    color: '#15803d', bg: 'rgba(52,199,89,0.1)', icon: CheckCircle2 },
}

const EVENT_STYLE: Record<string, { color: string; bg: string; icon: string }> = {
  submitted:      { color: '#0071E3', bg: 'rgba(0,113,227,0.12)',  icon: '→' },
  status_changed: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', icon: '↻' },
  reminder_sent:  { color: '#d97706', bg: 'rgba(245,158,11,0.12)', icon: '🔔' },
  reopened:       { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: '↺' },
  follow_up:      { color: '#6366f1', bg: 'rgba(99,102,241,0.12)', icon: '↩' },
  landlord_note:  { color: '#059669', bg: 'rgba(16,185,129,0.12)', icon: '💬' },
}

function fmtCompact(iso: string) {
  try {
    const d = new Date(iso)
    return `${d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })}`
  } catch { return '' }
}

function catFor(category: string) {
  return CATEGORIES.find(c => c.value === category) ?? {
    label: 'Maintenance', icon: Wrench, color: '#6b7280', bg: 'rgba(107,114,128,0.1)',
  }
}

// ── Image with fallback ───────────────────────────────────────────────────────

function ImgWithFallback({ src, alt = '', className = '', style = {}, onClick }: any) {
  const [broken, setBroken] = useState(false)
  if (broken || !src) {
    return (
      <div className={`flex items-center justify-center ${className}`}
        style={{ background: '#F5F5F7', ...style }}>
        <ImageOff size={16} className="text-[#AEAEB2]" />
      </div>
    )
  }
  return (
    <img src={src} alt={alt} className={className} style={style}
      onError={() => setBroken(true)} onClick={onClick} />
  )
}

// ── Image Lightbox ────────────────────────────────────────────────────────────

function ImageLightbox({ images, startIndex = 0, onClose }: {
  images: string[]; startIndex?: number; onClose: () => void
}) {
  const [idx, setIdx] = useState(startIndex)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft')  setIdx(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIdx(i => Math.min(images.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [images.length])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
      onClick={onClose}>
      <button className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/15 text-white z-10"
        onClick={onClose}>
        <X size={18} />
      </button>

      <ImgWithFallback
        src={images[idx]}
        className="max-w-[92vw] max-h-[82vh] rounded-2xl object-contain shadow-2xl"
        style={{ userSelect: 'none' }}
        onClick={(e: any) => e.stopPropagation()}
      />

      {images.length > 1 && (
        <>
          <button
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/15 text-white disabled:opacity-25 transition-opacity"
            disabled={idx === 0}
            onClick={e => { e.stopPropagation(); setIdx(i => i - 1) }}>
            <ChevronLeft size={20} />
          </button>
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/15 text-white disabled:opacity-25 transition-opacity"
            disabled={idx === images.length - 1}
            onClick={e => { e.stopPropagation(); setIdx(i => i + 1) }}>
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <button key={i} onClick={e => { e.stopPropagation(); setIdx(i) }}
                className="w-2 h-2 rounded-full transition-all"
                style={{ background: i === idx ? 'white' : 'rgba(255,255,255,0.35)' }} />
            ))}
          </div>
          <p className="absolute bottom-12 left-0 right-0 text-center text-[12px] text-white/50">
            {idx + 1} / {images.length}
          </p>
        </>
      )}
    </div>
  )
}

// ── Photo grid (clickable thumbnails) ────────────────────────────────────────

function PhotoGrid({ photos, onClickPhoto }: { photos: string[]; onClickPhoto: (idx: number) => void }) {
  if (!photos?.length) return null
  const cols = photos.length === 1 ? 'grid-cols-1' : photos.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
  return (
    <div className={`grid gap-2 ${cols}`}>
      {photos.map((url, i) => (
        <button key={i} className="relative group rounded-xl overflow-hidden"
          style={{ aspectRatio: '1', border: '1px solid rgba(0,0,0,0.08)' }}
          onClick={() => onClickPhoto(i)}>
          <ImgWithFallback src={url} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
            <ZoomIn size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
          </div>
        </button>
      ))}
    </div>
  )
}

// ── Ticket Detail Modal ──────────────────────────────────────────────────────

function TicketDetailModal({ initialReq, tenant, onClose, onUpdated }: {
  initialReq: any; tenant: any; onClose: () => void; onUpdated: () => void
}) {
  const [req, setReq] = useState(initialReq)
  const [logs, setLogs] = useState<any[]>([])
  const [reminding, setReminding] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [reminderSent, setReminderSent] = useState(false)
  const [lightbox, setLightbox] = useState<{ images: string[]; idx: number } | null>(null)

  const cat = catFor(req.category)
  const CatIcon = cat.icon
  const sc = MAINT_STATUS[req.status] ?? MAINT_STATUS.pending
  const StatusIcon = sc.icon
  const ticketCode = `ATM-MNT-${req.id.slice(-4).toUpperCase()}`

  const beforePhotos: string[] = req.photos ?? []
  const afterPhotos: string[]  = req.repair_photos ?? []
  const hasPhotos = beforePhotos.length > 0 || afterPhotos.length > 0

  useEffect(() => {
    fetchLogs()
    const channel = supabase.channel(`renter-ticket-${req.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_logs',
        filter: `request_id=eq.${req.id}` }, fetchLogs)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'maintenance_requests',
        filter: `id=eq.${req.id}` }, refreshReq)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [req.id])

  async function fetchLogs() {
    const { data } = await supabase.from('maintenance_logs').select('*')
      .eq('request_id', req.id).order('created_at', { ascending: true })
    setLogs(data ?? [])
  }

  async function refreshReq() {
    const { data } = await supabase.from('maintenance_requests').select('*').eq('id', req.id).single()
    if (data) { setReq(data); onUpdated() }
  }

  async function getLandlordId(): Promise<string | null> {
    if (!tenant?.room?.building_id) return null
    const { data } = await supabase.from('buildings').select('landlord_id')
      .eq('id', tenant.room.building_id).maybeSingle()
    return data?.landlord_id ?? null
  }

  async function sendReminder() {
    setReminding(true)
    const landlordId = await getLandlordId()
    await supabase.from('maintenance_logs').insert({
      request_id: req.id, event_type: 'reminder_sent',
      message: 'Follow-up reminder sent to landlord', actor: 'renter',
    })
    if (landlordId) {
      await supabase.from('notifications').insert({
        user_id: landlordId,
        title: 'Maintenance Follow-up',
        message: `${tenant.name} sent a follow-up reminder for Maintenance Ticket ${ticketCode}.`,
        notification_type: 'maintenance_reminder', is_read: false,
      })
    }
    setReminding(false)
    setReminderSent(true)
    setTimeout(() => setReminderSent(false), 60000)
  }

  async function reopenTicket() {
    setReopening(true)
    const landlordId = await getLandlordId()
    await supabase.from('maintenance_requests')
      .update({ status: 'pending', updated_at: new Date().toISOString() }).eq('id', req.id)
    await supabase.from('maintenance_logs').insert({
      request_id: req.id, event_type: 'reopened',
      message: 'Ticket reopened by renter — issue recurred', actor: 'renter',
    })
    if (landlordId) {
      await supabase.from('notifications').insert({
        user_id: landlordId,
        title: 'Maintenance Ticket Reopened',
        message: `${tenant.name} reopened Ticket ${ticketCode}. The issue has recurred.`,
        notification_type: 'maintenance_reopened', is_read: false,
      })
    }
    setReopening(false)
    onUpdated()
    onClose()
  }

  const timelineItems = [
    { id: '__submitted__', event_type: 'submitted', message: 'Maintenance request submitted', created_at: initialReq.created_at },
    ...logs,
  ]

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl flex flex-col"
          style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)', maxHeight: '92vh' }}>

          <div className="w-10 h-1 rounded-full mx-auto mt-3 sm:hidden" style={{ background: 'rgba(0,0,0,0.12)' }} />

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: cat.bg }}>
                <CatIcon size={18} style={{ color: cat.color }} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-[16px] font-bold text-[#1D1D1F]">{cat.label}</h2>
                  <span className="text-[10px] font-mono text-[#AEAEB2]">{ticketCode}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <StatusIcon size={11} style={{ color: sc.color }} />
                  <span className="text-[12px] font-semibold" style={{ color: sc.color }}>{sc.label}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: 'rgba(0,0,0,0.06)' }}>
              <X size={15} className="text-slate-500" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* Description */}
            <div className="px-4 py-3 rounded-xl" style={{ background: '#F5F5F7' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6E6E73] mb-1.5">Issue</p>
              <p className="text-[14px] text-[#1D1D1F] leading-relaxed">{req.description}</p>
            </div>

            {/* Before & After photos */}
            {hasPhotos && (
              <div className="space-y-3">
                {beforePhotos.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1.5 h-4 rounded-full flex-shrink-0" style={{ background: '#FF9500' }} />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#6E6E73]">Before · Issue Photos</p>
                      <span className="text-[10px] text-[#AEAEB2]">{beforePhotos.length}</span>
                    </div>
                    <PhotoGrid photos={beforePhotos} onClickPhoto={i => setLightbox({ images: beforePhotos, idx: i })} />
                  </div>
                )}

                {afterPhotos.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1.5 h-4 rounded-full flex-shrink-0" style={{ background: '#34C759' }} />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#6E6E73]">After · Repair Complete</p>
                      <span className="text-[10px] text-[#AEAEB2]">{afterPhotos.length}</span>
                    </div>
                    <PhotoGrid photos={afterPhotos} onClickPhoto={i => setLightbox({ images: afterPhotos, idx: i })} />
                  </div>
                )}
              </div>
            )}

            {/* Landlord response */}
            {req.landlord_notes && (
              <div className="px-4 py-3 rounded-xl"
                style={{ background: 'rgba(0,113,227,0.06)', border: '1px solid rgba(0,113,227,0.12)' }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#0071E3] mb-1.5">Landlord Response</p>
                <p className="text-[13px] text-[#1D1D1F] leading-relaxed">{req.landlord_notes}</p>
              </div>
            )}

            {/* Timeline */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6E6E73] mb-1.5">Activity</p>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
                {[...timelineItems].reverse().map((item, idx) => {
                  const es = EVENT_STYLE[item.event_type] ?? EVENT_STYLE.submitted
                  return (
                    <div key={item.id} className="flex items-center gap-2.5 px-3 py-2"
                      style={idx > 0 ? { borderTop: '1px solid rgba(0,0,0,0.05)' } : {}}>
                      <span className="text-[12px] flex-shrink-0 w-4 text-center" style={{ color: es.color }}>{es.icon}</span>
                      <p className="flex-1 text-[12px] text-[#1D1D1F] leading-snug min-w-0">{item.message}</p>
                      <span className="text-[10px] text-[#AEAEB2] flex-shrink-0 whitespace-nowrap">{fmtCompact(item.created_at)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Action footer */}
          <div className="px-5 pb-5 pt-3 flex-shrink-0 space-y-2"
            style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
            {(req.status === 'pending' || req.status === 'in_progress') && (
              <button onClick={sendReminder} disabled={reminding || reminderSent}
                className="w-full h-11 rounded-xl font-semibold text-[14px] flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
                style={reminderSent
                  ? { background: 'rgba(52,199,89,0.1)', color: '#15803d', border: '1px solid rgba(52,199,89,0.2)' }
                  : { background: 'rgba(245,158,11,0.1)', color: '#d97706', border: '1px solid rgba(245,158,11,0.2)' }}>
                <Bell size={15} />
                {reminderSent ? 'Reminder Sent ✓' : reminding ? 'Sending…' : 'Remind Landlord'}
              </button>
            )}
            {req.status === 'resolved' && (
              <button onClick={reopenTicket} disabled={reopening}
                className="w-full h-11 rounded-xl font-semibold text-[14px] flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}>
                <RefreshCw size={15} />
                {reopening ? 'Reopening…' : 'Reopen — Issue Returned'}
              </button>
            )}
            <button onClick={onClose}
              className="w-full h-10 rounded-xl font-medium text-[14px] text-[#6E6E73]"
              style={{ background: 'rgba(0,0,0,0.05)' }}>
              Close
            </button>
          </div>
        </div>
      </div>

      {lightbox && (
        <ImageLightbox images={lightbox.images} startIndex={lightbox.idx} onClose={() => setLightbox(null)} />
      )}
    </>
  )
}

// ── Maintenance Form Modal ───────────────────────────────────────────────────

function MaintenanceFormModal({ tenant, onClose, onSaved }: {
  tenant: any; onClose: () => void; onSaved: () => void
}) {
  const [category, setCategory] = useState('repair')
  const [urgency, setUrgency] = useState('medium')
  const [description, setDescription] = useState('')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function addFiles(files: FileList | null) {
    if (!files) return
    const slots = MAX_PHOTOS - photoFiles.length
    if (slots <= 0) return
    const toAdd = Array.from(files).slice(0, slots)
    setPhotoFiles(prev => [...prev, ...toAdd].slice(0, MAX_PHOTOS))
    const readers = toAdd.map(f => new Promise<string>(res => {
      const r = new FileReader()
      r.onload = ev => res(ev.target?.result as string)
      r.readAsDataURL(f)
    }))
    Promise.all(readers).then(newPreviews => {
      setPhotoPreviews(prev => [...prev, ...newPreviews].slice(0, MAX_PHOTOS))
    })
  }

  function removePhoto(i: number) {
    setPhotoFiles(prev => prev.filter((_, idx) => idx !== i))
    setPhotoPreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit() {
    if (!description.trim()) { setError('Please describe the issue.'); return }
    setSubmitting(true); setError('')

    const photos: string[] = []
    for (const file of photoFiles) {
      const ext = file.name.split('.').pop()
      const path = `${tenant.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('maintenance-photos').upload(path, file)
      if (!upErr) {
        const { data: signed } = await supabase.storage.from('maintenance-photos').createSignedUrl(path, 31536000)
        const url = signed?.signedUrl ?? supabase.storage.from('maintenance-photos').getPublicUrl(path).data.publicUrl
        photos.push(url)
      }
    }

    const { data: inserted, error: insertErr } = await supabase.from('maintenance_requests').insert({
      tenant_id: tenant.id,
      room_id: tenant.room_id,
      category,
      description: description.trim(),
      urgency,
      photos: photos.length > 0 ? photos : null,
      status: 'pending',
    }).select('id').single()

    if (insertErr) { setError('Failed to submit. Try again.'); setSubmitting(false); return }

    if (inserted?.id) {
      await supabase.from('maintenance_logs').insert({
        request_id: inserted.id,
        event_type: 'submitted',
        message: `${CATEGORIES.find(c => c.value === category)?.label ?? 'Maintenance'} request submitted`,
        actor: 'renter',
      })
    }

    if (tenant.room?.building_id) {
      const { data: bldg } = await supabase.from('buildings').select('landlord_id').eq('id', tenant.room.building_id).maybeSingle()
      if (bldg?.landlord_id) {
        await supabase.from('notifications').insert({
          user_id: bldg.landlord_id,
          title: 'Maintenance Request',
          message: `${tenant.name} submitted a ${CATEGORIES.find(c => c.value === category)?.label.toLowerCase()} request: "${description.trim().slice(0, 80)}"`,
          notification_type: 'maintenance_request', is_read: false,
        })
      }
    }

    setSubmitting(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div className="relative w-full sm:max-w-lg flex flex-col items-center justify-center rounded-t-2xl sm:rounded-2xl px-8 py-12 text-center"
          style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
            style={{ background: 'rgba(52,199,89,0.12)' }}>
            <CheckCircle size={28} style={{ color: '#15803d' }} />
          </div>
          <h2 className="text-[20px] font-bold text-[#1D1D1F] mb-2">Request Submitted</h2>
          <p className="text-[14px] text-[#6E6E73] max-w-xs leading-relaxed">
            Your maintenance request is pending review. Tap any ticket to track progress.
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="w-10 h-1 rounded-full mx-auto mt-3 sm:hidden" style={{ background: 'rgba(0,0,0,0.12)' }} />
        <div className="flex items-center justify-between px-6 pt-5 pb-4"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
          <h2 className="text-[18px] font-bold text-[#1D1D1F]">New Maintenance Request</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl"
            style={{ background: 'rgba(0,0,0,0.06)' }}>
            <X size={15} className="text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Category */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#6E6E73] mb-2">Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon; const active = category === cat.value
                return (
                  <button key={cat.value} onClick={() => setCategory(cat.value)}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-xl text-[11px] font-semibold transition-all"
                    style={active
                      ? { background: cat.bg, color: cat.color, border: `1.5px solid ${cat.color}40` }
                      : { background: '#F5F5F7', color: '#6E6E73', border: '1.5px solid transparent' }}>
                    <Icon size={16} />{cat.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Urgency */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#6E6E73] mb-2">Urgency</label>
            <div className="flex gap-2">
              {URGENCIES.map(u => (
                <button key={u.value} onClick={() => setUrgency(u.value)}
                  className="flex-1 py-2 rounded-xl text-[12px] font-semibold transition-all"
                  style={urgency === u.value
                    ? { background: u.bg, color: u.color, border: `1.5px solid ${u.color}40` }
                    : { background: '#F5F5F7', color: '#6E6E73', border: '1.5px solid transparent' }}>
                  {u.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-[#6E6E73] mb-2">Description *</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Describe the issue in detail…" rows={4}
              className="w-full rounded-xl px-4 py-3 text-[14px] text-[#1D1D1F] outline-none focus:ring-2 focus:ring-[#0071E3] resize-none"
              style={{ background: '#F5F5F7' }} />
          </div>

          {/* Photos — up to 4 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-[#6E6E73]">
                Photos <span className="normal-case font-normal">(optional, up to {MAX_PHOTOS})</span>
              </label>
              {photoFiles.length > 0 && (
                <span className="text-[11px] text-[#AEAEB2]">{photoFiles.length}/{MAX_PHOTOS}</span>
              )}
            </div>

            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => addFiles(e.target.files)} />

            {photoPreviews.length > 0 ? (
              <div className="space-y-2">
                <div className={`grid gap-2 ${photoPreviews.length === 1 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {photoPreviews.map((src, i) => (
                    <div key={i} className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '1' }}>
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => removePhoto(i)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/55 flex items-center justify-center text-white">
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                  {photoFiles.length < MAX_PHOTOS && (
                    <button onClick={() => fileRef.current?.click()}
                      className="rounded-xl flex flex-col items-center justify-center gap-1.5 transition-colors"
                      style={{ aspectRatio: '1', background: '#F5F5F7', border: '1.5px dashed #D2D2D7' }}>
                      <Plus size={18} className="text-[#AEAEB2]" />
                      <span className="text-[11px] text-[#AEAEB2]">Add more</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="w-full h-20 rounded-xl flex flex-col items-center justify-center gap-2"
                style={{ background: '#F5F5F7', border: '1.5px dashed #D2D2D7' }}>
                <FileImage size={18} className="text-[#AEAEB2]" />
                <span className="text-[12px] text-[#AEAEB2]">Tap to attach photos</span>
              </button>
            )}
          </div>

          {tenant?.room?.room_number && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: '#F5F5F7' }}>
              <Building2 size={14} className="text-[#AEAEB2]" />
              <span className="text-[13px] text-[#6E6E73]">Room {tenant.room.room_number} · Auto-filled</span>
            </div>
          )}

          {error && <p className="text-[12px] text-red-500 font-medium">{error}</p>}

          <button onClick={handleSubmit} disabled={submitting || !description.trim()}
            className="w-full h-12 rounded-xl text-white font-semibold text-[15px] transition-all disabled:opacity-50"
            style={{ background: '#0071E3', boxShadow: '0 4px 12px rgba(0,113,227,0.3)' }}>
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function Requests() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [tenant, setTenant] = useState<any>(null)
  const [maintRequests, setMaintRequests] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [selectedReq, setSelectedReq] = useState<any>(null)

  useEffect(() => { init() }, [])

  useEffect(() => {
    if (!profile?.id) return
    const channel = supabase.channel('renter-maint-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_requests' }, init)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile?.id])

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

    const { data: mReqs } = await supabase
      .from('maintenance_requests')
      .select('*')
      .eq('tenant_id', tenantRow.id)
      .order('created_at', { ascending: false })

    setMaintRequests(mReqs ?? [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="space-y-3 max-w-lg mx-auto animate-pulse">
        <div className="h-8 w-40 rounded-xl" style={{ background: 'rgba(255,255,255,0.4)' }} />
        {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl" style={{ background: 'rgba(255,255,255,0.4)' }} />)}
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.3)' }}>
          <Wrench size={28} className="text-[#AEAEB2]" />
        </div>
        <h2 className="text-[22px] font-semibold text-[#1D1D1F] mb-2">Not Assigned Yet</h2>
        <p className="text-[15px] text-[#6E6E73] max-w-xs">Your landlord hasn't assigned you to a room. Check back soon.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F]">Maintenance</h1>
          <p className="text-[13px] text-[#6E6E73] mt-0.5">
            {tenant.room?.room_number ? `Room ${tenant.room.room_number}` : 'Your Room'}
          </p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 h-10 px-4 text-white rounded-xl text-[13px] font-semibold"
          style={{ background: '#0071E3', boxShadow: '0 4px 12px rgba(0,113,227,0.25)' }}>
          <Plus size={15} /> New
        </button>
      </div>

      {/* List */}
      {maintRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
            style={{ background: 'rgba(255,255,255,0.35)' }}>
            <Wrench size={22} className="text-[#AEAEB2]" />
          </div>
          <p className="text-[16px] font-semibold text-[#1D1D1F]">No maintenance requests</p>
          <p className="text-[13px] text-[#6E6E73] mt-1">Tap + New to report a room issue.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {maintRequests.map(req => {
            const cat = catFor(req.category)
            const CatIcon = cat.icon
            const sc = MAINT_STATUS[req.status] ?? MAINT_STATUS.pending
            const StatusIcon = sc.icon
            const firstPhoto = req.photos?.[0] ?? null
            const photoCount = (req.photos?.length ?? 0) + (req.repair_photos?.length ?? 0)

            return (
              <div key={req.id}
                onClick={() => setSelectedReq(req)}
                className="p-4 cursor-pointer active:scale-[0.99] transition-transform"
                style={{ ...GLASS, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: cat.bg }}>
                      <CatIcon size={15} style={{ color: cat.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[#1D1D1F] leading-snug">{cat.label}</p>
                      <p className="text-[12px] text-[#6E6E73] mt-0.5 line-clamp-2">{req.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[11px] text-[#AEAEB2]">{timeAgo(req.created_at)}</p>
                        {photoCount > 0 && (
                          <span className="text-[10px] text-[#AEAEB2] flex items-center gap-0.5">
                            <FileImage size={9} /> {photoCount} photo{photoCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: sc.bg }}>
                      <StatusIcon size={10} style={{ color: sc.color }} />
                      <span className="text-[10px] font-bold" style={{ color: sc.color }}>{sc.label}</span>
                    </div>
                    {req.urgency && (() => {
                      const urg = URGENCIES.find(u => u.value === req.urgency)
                      return urg ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: urg.bg, color: urg.color }}>{urg.label}</span>
                      ) : null
                    })()}
                  </div>
                </div>

                {/* Photo strip — first before + first after */}
                {(firstPhoto || req.repair_photos?.[0]) && (
                  <div className="flex gap-2 mt-3">
                    {firstPhoto && (
                      <div className="relative flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 80, height: 64 }}>
                        <ImgWithFallback src={firstPhoto} className="w-full h-full object-cover" />
                        {(req.photos?.length ?? 0) > 1 && (
                          <div className="absolute bottom-1 right-1 bg-black/55 rounded-full px-1.5 py-0.5">
                            <span className="text-[9px] text-white font-bold">+{req.photos.length - 1}</span>
                          </div>
                        )}
                        <div className="absolute top-1 left-1 rounded-md px-1 py-0.5"
                          style={{ background: 'rgba(255,149,0,0.85)' }}>
                          <span className="text-[8px] font-bold text-white">BEFORE</span>
                        </div>
                      </div>
                    )}
                    {req.repair_photos?.[0] && (
                      <div className="relative flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 80, height: 64 }}>
                        <ImgWithFallback src={req.repair_photos[0]} className="w-full h-full object-cover" />
                        {(req.repair_photos?.length ?? 0) > 1 && (
                          <div className="absolute bottom-1 right-1 bg-black/55 rounded-full px-1.5 py-0.5">
                            <span className="text-[9px] text-white font-bold">+{req.repair_photos.length - 1}</span>
                          </div>
                        )}
                        <div className="absolute top-1 left-1 rounded-md px-1 py-0.5"
                          style={{ background: 'rgba(52,199,89,0.85)' }}>
                          <span className="text-[8px] font-bold text-white">AFTER</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {req.landlord_notes && (
                  <div className="mt-3 px-3 py-2.5 rounded-xl"
                    style={{ background: 'rgba(0,113,227,0.06)', border: '1px solid rgba(0,113,227,0.12)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#6E6E73] mb-1">Landlord Response</p>
                    <p className="text-[12px] text-[#1D1D1F]">{req.landlord_notes}</p>
                  </div>
                )}

                <p className="text-[11px] text-[#0071E3] mt-2.5 font-medium">Tap to view details & timeline →</p>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <MaintenanceFormModal tenant={tenant} onClose={() => setShowForm(false)} onSaved={init} />
      )}

      {selectedReq && (
        <TicketDetailModal
          initialReq={selectedReq}
          tenant={tenant}
          onClose={() => setSelectedReq(null)}
          onUpdated={init}
        />
      )}
    </div>
  )
}
