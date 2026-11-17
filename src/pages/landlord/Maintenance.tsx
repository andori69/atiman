// @ts-nocheck
import { useEffect, useState, useMemo, useRef } from 'react'
import {
  Wrench, Droplets, Zap, Hammer, Sparkles,
  CheckCircle2, Clock, X, Search, LayoutGrid,
  FileImage, ChevronLeft, ChevronRight, ZoomIn, ImageOff, Plus,
  AlertTriangle, RotateCcw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { timeAgo } from '@/lib/utils'

const MAX_REPAIR_PHOTOS = 4

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
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(255,255,255,0.5)',
  borderRadius: 14,
  boxShadow: '0 2px 8px rgba(108,92,231,0.05)',
  cursor: 'pointer',
  willChange: 'transform',
  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
}

const GLASS_MODAL = {
  background: 'rgba(255,255,255,0.95)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.7)',
  borderRadius: 20,
  boxShadow: '0 24px 64px rgba(100,80,200,0.18)',
}

type Request = {
  id: string; description: string; category: string; urgency: string
  status: string; landlord_notes: string | null; created_at: string
  photos: string[] | null; repair_photos: string[] | null
  reopen_count: number
  tenant: { name: string; user_id: string | null; photo_url: string | null } | null
  room: { room_number: string } | null
  avatar_url?: string | null
}

const CATEGORY_CONFIG: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  repair:     { icon: Hammer,   label: 'Repair',      color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)'  },
  electrical: { icon: Zap,      label: 'Electrical',  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
  plumbing:   { icon: Droplets, label: 'Plumbing',    color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)'  },
  cleaning:   { icon: Sparkles, label: 'Cleaning',    color: '#10b981', bg: 'rgba(16,185,129,0.1)'  },
  structural: { icon: Hammer,   label: 'Structural',  color: '#6366f1', bg: 'rgba(99,102,241,0.1)'  },
  other:      { icon: Wrench,   label: 'Other',       color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
}

const URGENCY_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  low:    { bg: 'rgba(90,200,250,0.12)',  color: '#0369a1', label: 'Low'    },
  medium: { bg: 'rgba(255,149,0,0.12)',   color: '#d97706', label: 'Medium' },
  high:   { bg: 'rgba(255,59,48,0.12)',   color: '#dc2626', label: 'High'   },
}

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string; icon: any }> = {
  pending:     { bg: 'rgba(255,59,48,0.1)',   color: '#dc2626', label: 'PENDING',     icon: Clock        },
  in_progress: { bg: 'rgba(245,158,11,0.12)', color: '#d97706', label: 'IN PROGRESS', icon: Wrench       },
  resolved:    { bg: 'rgba(52,199,89,0.12)',  color: '#15803d', label: 'RESOLVED',    icon: CheckCircle2 },
}

const STATUS_ORDER = ['pending', 'in_progress', 'resolved']

const MAINT_SECTIONS = [
  { key: 'pending',     label: 'Pending',     icon: Clock,        color: '#dc2626', bg: 'rgba(255,59,48,0.08)'  },
  { key: 'in_progress', label: 'In Progress', icon: Wrench,       color: '#0071E3', bg: 'rgba(0,113,227,0.1)'  },
  { key: 'resolved',    label: 'Resolved',    icon: CheckCircle2, color: '#15803d', bg: 'rgba(52,199,89,0.1)'  },
]
const URGENCY_SCORE: Record<string, number> = { high: 0, medium: 1, low: 2 }

function initials(name: string) { return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() }
function avatarColor(name: string) {
  const c = ['#8b5cf6','#3b82f6','#10b981','#f59e0b','#ef4444','#06b6d4','#6366f1','#14b8a6']
  let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % c.length; return c[h]
}

function Avatar({ url, name, size = 30 }: { url?: string | null; name: string; size?: number }) {
  const [broken, setBroken] = useState(false)
  const dim = `${size}px`
  if (url && !broken) return (
    <img src={url} alt={name} loading="lazy" decoding="async"
      style={{ width: dim, height: dim, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      onError={() => setBroken(true)} />
  )
  return (
    <div style={{
      width: dim, height: dim, borderRadius: '50%', flexShrink: 0,
      background: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: 700, fontSize: size * 0.33,
    }}>
      {initials(name)}
    </div>
  )
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
    <img src={src} alt={alt} loading="lazy" decoding="async" className={className} style={style}
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

/* ── Detail Modal ── */
function DetailModal({ req, onClose, onSaved }: { req: Request; onClose: () => void; onSaved: (patch: Partial<Request> & { id: string }) => void }) {
  const [notes, setNotes] = useState(req.landlord_notes ?? '')
  const [status, setStatus] = useState(req.status)
  const [loading, setLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [followUpNote, setFollowUpNote] = useState('')
  const [reopening, setReopening] = useState(false)
  const [lightbox, setLightbox] = useState<{ images: string[]; idx: number } | null>(null)

  // Repair photo upload state
  const [repairFiles, setRepairFiles] = useState<File[]>([])
  const [repairPreviews, setRepairPreviews] = useState<string[]>([])
  const repairFileRef = useRef<HTMLInputElement>(null)

  const catCfg = CATEGORY_CONFIG[req.category] ?? CATEGORY_CONFIG.other
  const urgCfg = URGENCY_CONFIG[req.urgency] ?? URGENCY_CONFIG.low
  const avatarUrl = req.avatar_url ?? req.tenant?.photo_url ?? null

  const beforePhotos: string[] = req.photos ?? []
  const existingRepairPhotos: string[] = req.repair_photos ?? []
  const totalRepairSlots = existingRepairPhotos.length + repairPreviews.length

  useEffect(() => {
    fetchLogs()
    const channel = supabase.channel(`landlord-ticket-${req.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_logs',
        filter: `request_id=eq.${req.id}` }, fetchLogs)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [req.id])

  async function fetchLogs() {
    const { data } = await supabase.from('maintenance_logs').select('*')
      .eq('request_id', req.id).order('created_at', { ascending: true })
    setLogs(data ?? [])
  }

  function addRepairFiles(files: FileList | null) {
    if (!files) return
    const slots = MAX_REPAIR_PHOTOS - totalRepairSlots
    if (slots <= 0) return
    const toAdd = Array.from(files).slice(0, slots)
    const newFiles = [...repairFiles, ...toAdd]
    setRepairFiles(newFiles)
    const readers = toAdd.map(f => new Promise<string>(res => {
      const r = new FileReader()
      r.onload = ev => res(ev.target?.result as string)
      r.readAsDataURL(f)
    }))
    Promise.all(readers).then(newPreviews => {
      setRepairPreviews(prev => [...prev, ...newPreviews])
    })
  }

  function removeRepairPreview(i: number) {
    setRepairFiles(prev => prev.filter((_, idx) => idx !== i))
    setRepairPreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  async function reopenAsFollowUp() {
    setReopening(true)
    const newCount = (req.reopen_count ?? 0) + 1
    await supabase.from('maintenance_requests').update({
      status: 'in_progress',
      reopen_count: newCount,
      updated_at: new Date().toISOString(),
    }).eq('id', req.id)
    const logMsg = followUpNote.trim()
      ? `Reopened (×${newCount}): ${followUpNote.trim()}`
      : `Issue reopened for the ${newCount === 1 ? '1st' : newCount === 2 ? '2nd' : newCount === 3 ? '3rd' : `${newCount}th`} time — recurring problem`
    await supabase.from('maintenance_logs').insert({
      request_id: req.id, event_type: 'follow_up', message: logMsg, actor: 'landlord',
    })
    if (req.tenant?.user_id) {
      const roomCtx = req.room?.room_number ? ` (Room ${req.room.room_number})` : ''
      await supabase.from('notifications').insert({
        user_id: req.tenant.user_id,
        title: 'Maintenance Follow-Up',
        message: `Your maintenance request${roomCtx} has been reopened for follow-up.${followUpNote.trim() ? ` Note: ${followUpNote.trim()}` : ''}`,
        notification_type: 'maintenance_update', is_read: false,
      })
    }
    setReopening(false)
    onSaved({ id: req.id, status: 'in_progress', reopen_count: newCount })
    onClose()
  }

  async function handleSave() {
    setLoading(true)
    setSaveError(null)
    try {
      const logInserts: any[] = []

      if (status !== req.status) {
        logInserts.push({
          request_id: req.id, event_type: 'status_changed',
          message: `Status changed to ${STATUS_CONFIG[status]?.label ?? status}`, actor: 'landlord',
        })
      }
      if (notes.trim() && notes.trim() !== (req.landlord_notes ?? '').trim()) {
        logInserts.push({
          request_id: req.id, event_type: 'landlord_note',
          message: 'Landlord added a response note', actor: 'landlord',
        })
      }

      // Upload repair photos
      const newRepairUrls: string[] = []
      for (const file of repairFiles) {
        const ext = file.name.split('.').pop()
        const path = `repair/${req.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage.from('maintenance-photos').upload(path, file)
        if (!upErr) {
          const { data: signed } = await supabase.storage.from('maintenance-photos').createSignedUrl(path, 31536000)
          const url = signed?.signedUrl ?? supabase.storage.from('maintenance-photos').getPublicUrl(path).data.publicUrl
          newRepairUrls.push(url)
        }
      }

      const allRepairPhotos = [...existingRepairPhotos, ...newRepairUrls]
      if (newRepairUrls.length > 0) {
        logInserts.push({
          request_id: req.id, event_type: 'landlord_note',
          message: `Landlord uploaded ${newRepairUrls.length} repair photo${newRepairUrls.length > 1 ? 's' : ''}`, actor: 'landlord',
        })
      }

      // Use .select('id') so we can detect when RLS silently blocks the update (0 rows → empty array, no error)
      const { data: updated, error: updateErr } = await supabase
        .from('maintenance_requests')
        .update({
          landlord_notes: notes.trim() || null,
          status,
          repair_photos: allRepairPhotos.length > 0 ? allRepairPhotos : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', req.id)
        .select('id')

      if (updateErr) throw new Error(updateErr.message)
      if (!updated?.length) throw new Error('Save was blocked by database permissions. Run the maintenance RLS policy SQL in the Supabase SQL Editor first.')

      if (logInserts.length) {
        await supabase.from('maintenance_logs').insert(logInserts)
      }

      if (status !== req.status && req.tenant?.user_id) {
        const roomCtx = req.room?.room_number ? ` (Room ${req.room.room_number})` : ''
        const catCtx = req.category ? ` — ${req.category.charAt(0).toUpperCase() + req.category.slice(1)}` : ''
        const msgs: Record<string, string> = {
          in_progress: `Your maintenance request${roomCtx}${catCtx} is now in progress.`,
          resolved:    `Your maintenance request${roomCtx}${catCtx} has been resolved.`,
        }
        if (msgs[status]) {
          await supabase.from('notifications').insert({
            user_id: req.tenant.user_id,
            title: status === 'resolved' ? 'Maintenance Resolved' : 'Maintenance In Progress',
            message: msgs[status] + (notes.trim() ? ` Note: ${notes.trim()}` : ''),
            notification_type: 'maintenance_update', is_read: false,
          })
        }
      }

      onSaved({
        id: req.id,
        status,
        landlord_notes: notes.trim() || null,
        repair_photos: allRepairPhotos.length > 0 ? allRepairPhotos : null,
      })
      onClose()
    } catch (err: any) {
      setSaveError(err?.message ?? 'Failed to save. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const timelineItems = [
    { id: '__submitted__', event_type: 'submitted', message: 'Request submitted', created_at: req.created_at },
    ...logs,
  ]

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden" style={GLASS_MODAL}>
          <div className="flex items-start justify-between px-6 py-5 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="flex items-center gap-3 min-w-0">
              <Avatar url={avatarUrl} name={req.tenant?.name ?? '?'} size={44} />
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold text-[#1e1b4b] truncate">{req.tenant?.name ?? 'Unknown'}</h2>
                <p className="text-[13px] text-slate-400 mt-0.5">Room {req.room?.room_number ?? '?'}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: urgCfg.bg, color: urgCfg.color }}>{urgCfg.label}</span>
                  <span className="text-[11px] text-slate-400">{catCfg.label} · {timeAgo(req.created_at)}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-slate-400 flex-shrink-0 ml-2"
              style={{ background: 'rgba(0,0,0,0.05)' }}><X size={16} /></button>
          </div>

          {/* Recurring issue banner */}
          {(req.reopen_count ?? 0) > 0 && (
            <div className="flex items-start gap-3 px-5 py-3.5 flex-shrink-0"
              style={{ background: 'rgba(239,68,68,0.07)', borderBottom: '1px solid rgba(239,68,68,0.14)' }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: 'rgba(239,68,68,0.12)' }}>
                <AlertTriangle size={14} className="text-red-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-red-600 leading-tight">
                  Recurring Issue — reopened {req.reopen_count} time{req.reopen_count !== 1 ? 's' : ''}
                </p>
                <p className="text-[11px] text-red-400 mt-0.5 leading-snug">
                  This problem keeps coming back. Consider a permanent fix or inspection.
                </p>
              </div>
            </div>
          )}

          <div className="flex-1 p-6 space-y-5 overflow-y-auto">
            {/* Description */}
            <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Description</p>
              <p className="text-[14px] text-[#1e1b4b] leading-relaxed">{req.description}</p>
            </div>

            {/* Before & After Photos */}
            {(beforePhotos.length > 0 || existingRepairPhotos.length > 0) && (
              <div className="space-y-3">
                {beforePhotos.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1.5 h-4 rounded-full flex-shrink-0" style={{ background: '#FF9500' }} />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Before · Issue Photos</p>
                      <span className="text-[10px] text-slate-300">{beforePhotos.length}</span>
                    </div>
                    <PhotoGrid photos={beforePhotos} onClickPhoto={i => setLightbox({ images: beforePhotos, idx: i })} />
                  </div>
                )}

                {existingRepairPhotos.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1.5 h-4 rounded-full flex-shrink-0" style={{ background: '#34C759' }} />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">After · Repair Photos</p>
                      <span className="text-[10px] text-slate-300">{existingRepairPhotos.length}</span>
                    </div>
                    <PhotoGrid photos={existingRepairPhotos} onClickPhoto={i => setLightbox({ images: existingRepairPhotos, idx: i })} />
                  </div>
                )}
              </div>
            )}

            {/* Status update */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Update Status</p>
              <div className="flex gap-2">
                {STATUS_ORDER.map(s => {
                  const cfg = STATUS_CONFIG[s]; const active = status === s
                  return (
                    <button key={s} onClick={() => setStatus(s)}
                      className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold transition-all"
                      style={active
                        ? { background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40` }
                        : { background: 'rgba(0,0,0,0.04)', color: '#94a3b8', border: '1px solid transparent' }}>
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Notes */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Response / Notes</p>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                placeholder="Add a response or notes for the renter…"
                className="w-full rounded-xl px-4 py-3 text-[14px] text-[#1e1b4b] outline-none focus:ring-2 focus:ring-[#6C5CE7]/40 resize-none"
                style={{ background: '#F5F5F7' }} />
            </div>

            {/* Repair / Completion Photos Upload */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 rounded-full flex-shrink-0" style={{ background: '#34C759' }} />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Repair Photos</p>
                </div>
                <span className="text-[10px] text-slate-400">
                  Optional · {totalRepairSlots}/{MAX_REPAIR_PHOTOS}
                </span>
              </div>

              <input ref={repairFileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => addRepairFiles(e.target.files)} />

              {repairPreviews.length > 0 && (
                <div className={`grid gap-2 mb-2 ${repairPreviews.length === 1 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                  {repairPreviews.map((src, i) => (
                    <div key={i} className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '1' }}>
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => removeRepairPreview(i)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/55 flex items-center justify-center text-white">
                        <X size={11} />
                      </button>
                      <div className="absolute bottom-1 left-1 rounded-md px-1.5 py-0.5"
                        style={{ background: 'rgba(52,199,89,0.85)' }}>
                        <span className="text-[8px] font-bold text-white">NEW</span>
                      </div>
                    </div>
                  ))}
                  {totalRepairSlots < MAX_REPAIR_PHOTOS && (
                    <button onClick={() => repairFileRef.current?.click()}
                      className="rounded-xl flex flex-col items-center justify-center gap-1.5 transition-colors"
                      style={{ aspectRatio: '1', background: '#F5F5F7', border: '1.5px dashed #D2D2D7' }}>
                      <Plus size={16} className="text-[#AEAEB2]" />
                    </button>
                  )}
                </div>
              )}

              {repairPreviews.length === 0 && totalRepairSlots < MAX_REPAIR_PHOTOS && (
                <button onClick={() => repairFileRef.current?.click()}
                  className="w-full h-16 rounded-xl flex items-center justify-center gap-2.5 transition-colors"
                  style={{ background: 'rgba(52,199,89,0.04)', border: '1.5px dashed rgba(52,199,89,0.4)' }}>
                  <FileImage size={16} style={{ color: '#34C759' }} />
                  <span className="text-[12px] font-medium" style={{ color: '#15803d' }}>Add repair / completion photos</span>
                </button>
              )}

              {totalRepairSlots >= MAX_REPAIR_PHOTOS && (
                <p className="text-[11px] text-[#AEAEB2] mt-1">Max {MAX_REPAIR_PHOTOS} repair photos reached.</p>
              )}
            </div>

            {/* Timeline */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Activity</p>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
                {[...timelineItems].reverse().map((item, idx) => {
                  const es = EVENT_STYLE[item.event_type] ?? EVENT_STYLE.submitted
                  return (
                    <div key={item.id} className="flex items-center gap-2.5 px-3 py-2"
                      style={idx > 0 ? { borderTop: '1px solid rgba(0,0,0,0.05)' } : {}}>
                      <span className="text-[12px] flex-shrink-0 w-4 text-center" style={{ color: es.color }}>{es.icon}</span>
                      <p className="flex-1 text-[12px] text-[#1e1b4b] leading-snug min-w-0">{item.message}</p>
                      <span className="text-[10px] text-slate-400 flex-shrink-0 whitespace-nowrap">{fmtCompact(item.created_at)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Follow-up section — only for resolved tickets */}
          {req.status === 'resolved' && (
            <div className="px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.06)', background: 'rgba(99,102,241,0.03)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400 mb-2">Follow-Up / Reopen</p>
              <textarea value={followUpNote} onChange={e => setFollowUpNote(e.target.value)} rows={2}
                placeholder="Optional follow-up note (issue recurred, needs re-check…)"
                className="w-full rounded-xl px-3 py-2.5 text-[13px] text-[#1e1b4b] outline-none resize-none mb-2"
                style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(99,102,241,0.2)' }} />
              <button onClick={reopenAsFollowUp} disabled={reopening}
                className="w-full h-10 rounded-xl font-semibold text-[13px] disabled:opacity-50 flex items-center justify-center gap-1.5"
                style={{ background: 'rgba(99,102,241,0.12)', color: '#4f46e5', border: '1px solid rgba(99,102,241,0.25)' }}>
                {reopening ? 'Reopening…' : '↩ Reopen as Follow-Up'}
              </button>
            </div>
          )}

          {saveError && (
            <div className="px-6 pb-2 flex-shrink-0">
              <div className="px-4 py-2.5 rounded-xl" style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)' }}>
                <p className="text-[12px] text-red-600 leading-snug">{saveError}</p>
              </div>
            </div>
          )}

          <div className="px-6 pb-6 pt-2 flex gap-3 flex-shrink-0">
            <button onClick={onClose} className="flex-1 h-11 rounded-xl font-medium text-[15px] text-slate-500"
              style={{ background: 'rgba(0,0,0,0.05)' }}>Cancel</button>
            <button onClick={handleSave} disabled={loading}
              className="flex-1 h-11 rounded-xl font-semibold text-[15px] text-white disabled:opacity-50"
              style={{ background: '#6C5CE7', boxShadow: '0 4px 12px rgba(108,92,231,0.35)' }}>
              {loading ? 'Saving…' : 'Save Changes'}
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

/* ── Compact Row Card ── */
function RequestCard({ req, onClick }: { req: Request; onClick: () => void }) {
  const catCfg   = CATEGORY_CONFIG[req.category] ?? CATEGORY_CONFIG.other
  const urgCfg   = URGENCY_CONFIG[req.urgency]   ?? URGENCY_CONFIG.low
  const stCfg    = STATUS_CONFIG[req.status]      ?? STATUS_CONFIG.pending
  const CatIcon  = catCfg.icon
  const avatarUrl = req.avatar_url ?? req.tenant?.photo_url ?? null
  const firstPhoto = req.photos?.[0] ?? null
  const hasRepair  = (req.repair_photos?.length ?? 0) > 0

  return (
    <div
      onClick={onClick}
      style={GLASS_CARD}
      className="px-3.5 py-2.5 flex items-center gap-3"
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateX(2px)'
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(108,92,231,0.12)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(108,92,231,0.05)'
      }}
    >
      {/* Category icon */}
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: catCfg.bg, border: `1px solid ${catCfg.color}20` }}>
        <CatIcon size={15} style={{ color: catCfg.color }} />
      </div>

      {/* Avatar */}
      <Avatar url={avatarUrl} name={req.tenant?.name ?? '?'} size={30} />

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-[13px] font-bold text-[#1e1b4b] truncate leading-tight">{req.tenant?.name ?? 'Unknown'}</p>
          <span className="text-[11px] text-slate-400 flex-shrink-0">· Rm {req.room?.room_number ?? '?'}</span>
          <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: catCfg.color }}>· {catCfg.label}</span>
          {(req.reopen_count ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>
              <RotateCcw size={9} />
              {req.reopen_count}×
            </span>
          )}
        </div>
        <p className="text-[12px] text-slate-500 truncate leading-snug mt-0.5">{req.description}</p>
      </div>

      {/* Before/After thumbnail strip */}
      {(firstPhoto || hasRepair) && (
        <div className="flex gap-1 flex-shrink-0">
          {firstPhoto && (
            <div className="relative w-10 h-10 rounded-lg overflow-hidden"
              style={{ border: '1.5px solid rgba(255,149,0,0.4)' }}>
              <ImgWithFallback src={firstPhoto} className="w-full h-full object-cover" />
            </div>
          )}
          {hasRepair && (
            <div className="relative w-10 h-10 rounded-lg overflow-hidden"
              style={{ border: '1.5px solid rgba(52,199,89,0.4)' }}>
              <ImgWithFallback src={req.repair_photos![0]} className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      )}

      {/* Right: status + urgency + time */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ background: stCfg.bg, color: stCfg.color }}>{stCfg.label}</span>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ background: urgCfg.bg, color: urgCfg.color }}>{urgCfg.label}</span>
        <span className="text-[10px] text-slate-400 whitespace-nowrap">{timeAgo(req.created_at)}</span>
      </div>
    </div>
  )
}

/* ── Main Page ── */
export default function LandlordMaintenance() {
  const { profile } = useAuth()
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Request | null>(null)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('pending')

  useEffect(() => { init() }, [])

  useEffect(() => {
    const channel = supabase.channel('maintenance-page-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_requests' }, () => init(true))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function init(silent = false) {
    if (!silent) setLoading(true)
    try {
      const { data: bldgs } = await supabase.from('buildings').select('id').eq('landlord_id', profile!.id)
      const bldgIds = (bldgs ?? []).map((b: any) => b.id)
      if (!bldgIds.length) { setRequests([]); return }

      const { data: roomsData } = await supabase.from('rooms').select('id').in('building_id', bldgIds)
      const roomIds = (roomsData ?? []).map((r: any) => r.id)
      if (!roomIds.length) { setRequests([]); return }

      const { data } = await supabase
        .from('maintenance_requests')
        .select('*, tenant:tenants(name, user_id, photo_url), room:rooms(room_number)')
        .in('room_id', roomIds)
        .order('created_at', { ascending: false })

      setRequests((data ?? []) as Request[])
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const counts = useMemo(() => ({
    all:         requests.length,
    pending:     requests.filter(r => r.status === 'pending').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    resolved:    requests.filter(r => r.status === 'resolved').length,
  }), [requests])

  const FILTER_CARDS = [
    { key: 'pending',     label: 'Pending',     icon: Clock,        value: counts.pending,
      activeStyle: { background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.25)' },
      iconActive: { background: '#dc2626', color: 'white' }, iconInactive: { background: 'rgba(255,59,48,0.08)', color: '#dc2626' } },
    { key: 'in_progress', label: 'In Progress', icon: Wrench,       value: counts.in_progress,
      activeStyle: { background: 'rgba(0,113,227,0.12)', border: '1px solid rgba(0,113,227,0.25)' },
      iconActive: { background: '#0071E3', color: 'white' }, iconInactive: { background: 'rgba(0,113,227,0.1)', color: '#0071E3' } },
    { key: 'resolved',    label: 'Resolved',    icon: CheckCircle2, value: counts.resolved,
      activeStyle: { background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.22)' },
      iconActive: { background: '#34C759', color: 'white' }, iconInactive: { background: 'rgba(52,199,89,0.1)', color: '#15803d' } },
    { key: 'all',         label: 'All',         icon: LayoutGrid,   value: counts.all,
      activeStyle: { background: 'rgba(108,92,231,0.15)', border: '1px solid rgba(108,92,231,0.3)' },
      iconActive: { background: '#6C5CE7', color: 'white' }, iconInactive: { background: 'rgba(108,92,231,0.1)', color: '#6C5CE7' } },
  ]

  const searchFiltered = useMemo(() => {
    const q = search.toLowerCase()
    return q
      ? requests.filter(r =>
          r.tenant?.name?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          r.room?.room_number?.toLowerCase().includes(q) ||
          (CATEGORY_CONFIG[r.category]?.label ?? '').toLowerCase().includes(q)
        )
      : requests
  }, [requests, search])

  const sectionsToShow = useMemo(() =>
    activeFilter === 'all' ? MAINT_SECTIONS : MAINT_SECTIONS.filter(s => s.key === activeFilter),
  [activeFilter])

  function sortSection(reqs: Request[]) {
    return [...reqs].sort((a, b) => {
      const urgA = URGENCY_SCORE[a.urgency] ?? 2, urgB = URGENCY_SCORE[b.urgency] ?? 2
      if (urgA !== urgB) return urgA - urgB
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }

  const totalVisible = useMemo(() =>
    searchFiltered.filter(r => activeFilter === 'all' || r.status === activeFilter).length,
  [searchFiltered, activeFilter])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-[22px] sm:text-[28px] font-semibold tracking-tight text-[#1e1b4b]">Maintenance</h1>
        <p className="text-[13px] text-slate-400 mt-0.5">
          {counts.pending > 0 ? `${counts.pending} pending · ${requests.length} total` : `${requests.length} total requests`}
        </p>
      </div>

      {/* Filter / stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {FILTER_CARDS.map(({ key, label, icon: Icon, value, activeStyle, iconActive, iconInactive }) => (
          <button key={key} onClick={() => setActiveFilter(key)}
            className="flex items-center gap-2.5 p-3 sm:p-3.5 rounded-2xl text-left transition-all duration-200"
            style={activeFilter === key ? { ...GLASS, ...activeStyle } : GLASS}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all"
              style={activeFilter === key ? iconActive : iconInactive}>
              <Icon size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[20px] sm:text-[22px] font-bold text-[#1e1b4b] leading-none tabular-nums">{value}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by renter, room, category, or description…"
          className="w-full h-10 pl-9 pr-4 rounded-xl text-[13px] text-[#1e1b4b] outline-none focus:ring-2 focus:ring-[#6C5CE7]/40"
          style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.6)' }}
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400"
            style={{ background: 'rgba(0,0,0,0.06)' }}>
            <X size={13} />
          </button>
        )}
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="px-3.5 py-2.5 rounded-[14px] flex items-center gap-3 animate-pulse"
              style={{ background: 'rgba(255,255,255,0.28)', border: '1px solid rgba(255,255,255,0.5)' }}>
              <div className="w-8 h-8 rounded-xl flex-shrink-0" style={{ background: 'rgba(0,0,0,0.06)' }} />
              <div className="w-7 h-7 rounded-full flex-shrink-0" style={{ background: 'rgba(0,0,0,0.06)' }} />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-32 rounded-lg" style={{ background: 'rgba(0,0,0,0.06)' }} />
                <div className="h-2.5 w-48 rounded-lg" style={{ background: 'rgba(0,0,0,0.04)' }} />
              </div>
              <div className="space-y-1.5 flex-shrink-0 items-end flex flex-col">
                <div className="h-4 w-16 rounded-full" style={{ background: 'rgba(0,0,0,0.05)' }} />
                <div className="h-3.5 w-12 rounded-full" style={{ background: 'rgba(0,0,0,0.04)' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && requests.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.5)' }}>
            <Wrench size={24} className="text-slate-400" />
          </div>
          <h3 className="text-[17px] font-semibold text-[#1e1b4b] mb-1">No maintenance requests</h3>
          <p className="text-[14px] text-slate-400 max-w-xs">Requests submitted by renters will appear here.</p>
        </div>
      )}

      {/* Search returned nothing */}
      {!loading && requests.length > 0 && search && totalVisible === 0 && (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <Search size={22} className="text-slate-300 mb-2.5" />
          <p className="text-[15px] font-semibold text-[#1e1b4b]">No requests found</p>
          <p className="text-[13px] text-slate-400 mt-1">Try a different search term.</p>
        </div>
      )}

      {/* Sectioned list */}
      {!loading && requests.length > 0 && !(search && totalVisible === 0) && (
        <div className="space-y-4">
          {sectionsToShow.map(section => {
            const SectionIcon = section.icon
            const cards = sortSection(searchFiltered.filter(r => r.status === section.key))
            if (activeFilter === 'all' && cards.length === 0) return null
            return (
              <div key={section.key}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: section.bg }}>
                    <SectionIcon size={12} style={{ color: section.color }} />
                  </div>
                  <h2 className="text-[14px] font-bold text-[#1e1b4b]">{section.label}</h2>
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: section.bg, color: section.color }}>
                    {cards.length}
                  </span>
                </div>

                {cards.length === 0 ? (
                  <div className="flex items-center justify-center py-6 rounded-xl"
                    style={{ border: '1.5px dashed rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.12)' }}>
                    <p className="text-[12px] text-slate-400">No {section.label.toLowerCase()} requests</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {cards.map(req => (
                      <RequestCard key={req.id} req={req} onClick={() => setSelected(req)} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <DetailModal
          req={selected}
          onClose={() => setSelected(null)}
          onSaved={patch => {
            if (patch?.id) setRequests(prev => prev.map(r => r.id === patch.id ? { ...r, ...patch } : r))
            init(true)
          }}
        />
      )}
    </div>
  )
}
