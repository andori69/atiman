// @ts-nocheck
import { useEffect, useState, useRef } from 'react'
import { Plus, X, Pencil, Trash2, Megaphone, AlertTriangle, Info, MessageSquare, ImagePlus, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { timeAgo } from '@/lib/utils'

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

type Priority = 'urgent' | 'important' | 'regular'
type Announcement = {
  id: string; title: string; message: string
  priority: Priority; created_at: string; updated_at?: string | null; photo_url?: string | null
}

function fmtPostedAt(ts: string) {
  const d = new Date(ts)
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
}
function wasEdited(created_at: string, updated_at?: string | null) {
  if (!updated_at) return false
  return new Date(updated_at).getTime() - new Date(created_at).getTime() > 10_000
}

const PRIORITY_CONFIG: Record<Priority, {
  label: string; icon: typeof AlertTriangle
  accent: string; bg: string; border: string; badgeBg: string; badgeColor: string
}> = {
  urgent: {
    label: 'Urgent',
    icon: AlertTriangle,
    accent: '#dc2626',
    bg: 'rgba(239,68,68,0.06)',
    border: 'rgba(239,68,68,0.25)',
    badgeBg: 'rgba(239,68,68,0.12)',
    badgeColor: '#dc2626',
  },
  important: {
    label: 'Important',
    icon: Info,
    accent: '#d97706',
    bg: 'rgba(245,158,11,0.06)',
    border: 'rgba(245,158,11,0.25)',
    badgeBg: 'rgba(245,158,11,0.12)',
    badgeColor: '#d97706',
  },
  regular: {
    label: 'Announcement',
    icon: MessageSquare,
    accent: '#6C5CE7',
    bg: 'rgba(255,255,255,0.22)',
    border: 'rgba(255,255,255,0.45)',
    badgeBg: 'rgba(108,92,231,0.1)',
    badgeColor: '#6C5CE7',
  },
}

const PRIORITY_ORDER: Priority[] = ['urgent', 'important', 'regular']
function sortAnns(list: Announcement[]) {
  return [...list].sort((a, b) => {
    const pa = PRIORITY_ORDER.indexOf(a.priority)
    const pb = PRIORITY_ORDER.indexOf(b.priority)
    if (pa !== pb) return pa - pb
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

function AnnouncementModal({ ann, onClose, onSaved }: {
  ann?: Announcement; onClose: () => void; onSaved: () => void
}) {
  const { profile } = useAuth()
  const [title, setTitle] = useState(ann?.title ?? '')
  const [message, setMessage] = useState(ann?.message ?? '')
  const [priority, setPriority] = useState<Priority>(ann?.priority ?? 'regular')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(ann?.photo_url ?? null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setPhotoFile(f)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(f)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !message.trim()) return
    setLoading(true); setError('')

    let photoUrl: string | null = ann?.photo_url ?? null
    if (photoFile) {
      const ext = photoFile.name.split('.').pop() ?? 'jpg'
      const path = `announcements/${profile!.id}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('room-photos').upload(path, photoFile, { upsert: true })
      if (upErr) { setError('Photo upload failed: ' + upErr.message); setLoading(false); return }
      const { data: urlData } = supabase.storage.from('room-photos').getPublicUrl(path)
      photoUrl = urlData?.publicUrl ?? null
    }

    const payload = {
      landlord_id: profile!.id,
      title: title.trim(),
      message: message.trim(),
      priority,
      is_pinned: priority === 'urgent',
      target_buildings: null,
      photo_url: photoUrl,
    }

    const { error: err } = ann
      ? await supabase.from('announcements').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', ann.id)
      : await supabase.from('announcements').insert(payload)

    if (err) { setError(err.message); setLoading(false); return }

    // On new post (not edit): notify all linked renters
    if (!ann) {
      const { data: renters } = await supabase
        .from('profiles')
        .select('id')
        .eq('linked_landlord_id', profile!.id)
        .eq('role', 'renter')
        .eq('status', 'approved')

      if (renters && renters.length > 0) {
        const emoji = priority === 'urgent' ? '🚨' : priority === 'important' ? '⚠️' : '📢'
        const preview = message.trim().length > 120
          ? message.trim().slice(0, 117) + '...'
          : message.trim()
        await supabase.from('notifications').insert(
          renters.map((r: any) => ({
            user_id: r.id,
            title: `${emoji} ${title.trim()}`,
            message: preview,
            notification_type: 'announcement',
          }))
        )
      }
    }

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
          <h2 className="text-[18px] font-semibold text-[#1e1b4b]">
            {ann ? 'Edit Announcement' : 'New Announcement'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400"
            style={{ background: 'rgba(0,0,0,0.05)' }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 rounded-xl text-sm text-red-600">{error}</div>}

          {/* Priority selector */}
          <div>
            <label className={LABEL}>Priority</label>
            <div className="flex gap-2">
              {PRIORITY_ORDER.map(p => {
                const cfg = PRIORITY_CONFIG[p]
                const active = priority === p
                return (
                  <button key={p} type="button" onClick={() => setPriority(p)}
                    className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl text-[12px] font-semibold transition-all"
                    style={active
                      ? { background: cfg.badgeBg, color: cfg.accent, border: `1px solid ${cfg.border}` }
                      : { background: 'rgba(255,255,255,0.4)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.6)' }
                    }>
                    <cfg.icon size={15} />
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className={LABEL}>Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required
              placeholder="Announcement title…" className={INPUT} style={INPUT_STYLE} />
          </div>

          <div>
            <label className={LABEL}>Message *</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} required rows={4}
              placeholder="Write your announcement here…"
              className="w-full rounded-xl px-4 py-3 text-[15px] text-[#1e1b4b] outline-none transition-all resize-none"
              style={INPUT_STYLE} />
          </div>

          {/* Photo upload */}
          <div>
            <label className={LABEL}>Photo (optional)</label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            {photoPreview ? (
              <div className="relative rounded-xl overflow-hidden" style={{ maxHeight: 180 }}>
                <img src={photoPreview} alt="" className="w-full object-cover" style={{ maxHeight: 180 }} />
                <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-white"
                  style={{ background: 'rgba(0,0,0,0.5)' }}><X size={13} /></button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full h-16 rounded-xl flex items-center justify-center gap-2 transition-all"
                style={{ background: 'rgba(255,255,255,0.4)', border: '2px dashed rgba(108,92,231,0.25)', color: '#6C5CE7' }}>
                <ImagePlus size={18} />
                <span className="text-[13px] font-medium">Add Photo</span>
              </button>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 h-11 rounded-xl font-medium text-[15px] text-[#1e1b4b]"
              style={{ background: 'rgba(0,0,0,0.06)' }}>Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 h-11 rounded-xl font-medium text-[15px] text-white disabled:opacity-50"
              style={{ background: 'rgba(108,92,231,0.85)', boxShadow: '0 4px 12px rgba(108,92,231,0.3)' }}>
              {loading ? 'Saving…' : ann ? 'Save Changes' : 'Post Announcement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Announcements() {
  const { profile } = useAuth()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Announcement | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [viewAnn, setViewAnn] = useState<Announcement | null>(null)

  useEffect(() => { init() }, [])

  async function init() {
    setLoading(true)
    const { data: anns } = await supabase
      .from('announcements').select('id, title, message, priority, photo_url, created_at, updated_at')
      .eq('landlord_id', profile!.id)
      .order('created_at', { ascending: false })
    setAnnouncements(sortAnns((anns ?? []).map((a: any) => ({
      ...a,
      priority: (a.priority ?? 'regular') as Priority,
    }))))
    setLoading(false)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await supabase.from('announcements').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    init()
  }

  const grouped = PRIORITY_ORDER.map(p => ({
    priority: p,
    items: announcements.filter(a => a.priority === p),
  })).filter(g => g.items.length > 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#1e1b4b]">Announcements</h1>
          <p className="text-[15px] text-slate-400 mt-0.5">{announcements.length} total · sent to all renters</p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowModal(true) }}
          className="flex items-center gap-2 h-10 px-4 text-white rounded-xl text-[14px] font-medium"
          style={{ background: 'rgba(108,92,231,0.85)', boxShadow: '0 4px 12px rgba(108,92,231,0.3)' }}>
          <Plus size={16} /> New Announcement
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.35)' }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && announcements.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ background: 'rgba(255,255,255,0.4)' }}>
            <Megaphone size={28} className="text-slate-400" />
          </div>
          <h3 className="text-[18px] font-semibold text-[#1e1b4b] mb-2">No announcements yet</h3>
          <p className="text-[15px] text-slate-400 mb-6 max-w-xs">
            Post updates, notices, or urgent alerts to all your renters.
          </p>
          <button onClick={() => { setEditing(undefined); setShowModal(true) }}
            className="flex items-center gap-2 h-11 px-6 text-white rounded-xl text-[15px] font-medium"
            style={{ background: 'rgba(108,92,231,0.85)', boxShadow: '0 4px 12px rgba(108,92,231,0.3)' }}>
            <Plus size={18} /> Post First Announcement
          </button>
        </div>
      )}

      {/* Grouped announcement cards */}
      {!loading && grouped.map(({ priority, items }) => {
        const cfg = PRIORITY_CONFIG[priority]
        const Icon = cfg.icon
        return (
          <div key={priority}>
            {/* Priority group header */}
            <div className="flex items-center gap-2 mb-3">
              <Icon size={14} style={{ color: cfg.accent }} />
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: cfg.accent }}>
                {cfg.label}
              </span>
              <span className="text-[11px] text-slate-400">· {items.length}</span>
            </div>

            <div className="space-y-3">
              {items.map(ann => (
                <div key={ann.id}
                  onClick={() => setViewAnn(ann)}
                  style={{
                    background: cfg.bg,
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: `1px solid ${cfg.border}`,
                    borderRadius: 16,
                    boxShadow: priority === 'urgent'
                      ? '0 4px 16px rgba(239,68,68,0.1)'
                      : priority === 'important'
                      ? '0 4px 16px rgba(245,158,11,0.08)'
                      : '0 8px 32px rgba(108,92,231,0.06)',
                    cursor: 'pointer',
                  }}
                  className="p-5 transition-all hover:scale-[1.01]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: cfg.badgeBg, color: cfg.accent }}>
                          {cfg.label}
                        </span>
                        <span className="text-[11px] text-slate-400">{fmtPostedAt(ann.created_at)}</span>
                        {wasEdited(ann.created_at, ann.updated_at) && (
                          <span className="text-[10px] text-slate-300 italic">· edited</span>
                        )}
                      </div>
                      <h3 className="text-[16px] font-semibold text-[#1e1b4b] truncate">{ann.title}</h3>
                      <p className="text-[14px] text-slate-500 mt-1 line-clamp-2">{ann.message}</p>
                      {ann.photo_url && (
                        <div className="mt-2 flex items-center gap-1 text-[11px] font-medium" style={{ color: cfg.accent }}>
                          <ImagePlus size={11} /> Photo attached
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={e => { e.stopPropagation(); setEditing(ann); setShowModal(true) }}
                        className="h-8 w-8 rounded-xl flex items-center justify-center transition-all"
                        style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.8)' }}>
                        <Pencil size={13} className="text-slate-400" />
                      </button>
                      <button onClick={e => { e.stopPropagation(); setDeleteTarget(ann) }}
                        className="h-8 w-8 rounded-xl flex items-center justify-center transition-all"
                        style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.15)' }}>
                        <Trash2 size={13} className="text-red-500" />
                      </button>
                      <ChevronRight size={14} className="text-slate-300 ml-0.5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* View detail modal */}
      {viewAnn && (() => {
        const cfg = PRIORITY_CONFIG[viewAnn.priority]
        const Icon = cfg.icon
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setViewAnn(null)} />
            <div className="relative w-full max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[88vh] flex flex-col"
              style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 -4px 40px rgba(0,0,0,0.15)' }}>
              <div className="w-10 h-1 rounded-full mx-auto mt-3 sm:hidden" style={{ background: 'rgba(0,0,0,0.12)' }} />
              <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
                style={{ background: cfg.bg, borderBottom: `1px solid ${cfg.border}` }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: cfg.badgeBg }}>
                    <Icon size={16} style={{ color: cfg.accent }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cfg.accent }}>{cfg.label}</p>
                    <p className="text-[11px] text-slate-400">{fmtPostedAt(viewAnn.created_at)}</p>
                    {wasEdited(viewAnn.created_at, viewAnn.updated_at) && (
                      <p className="text-[10px] text-slate-300 italic">
                        Edited {fmtPostedAt(viewAnn.updated_at!)}
                      </p>
                    )}
                  </div>
                </div>
                <button onClick={() => setViewAnn(null)} className="p-2 rounded-xl text-slate-400"
                  style={{ background: 'rgba(0,0,0,0.06)' }}><X size={16} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <h2 className="text-[20px] font-bold text-[#1e1b4b] leading-snug">{viewAnn.title}</h2>
                <p className="text-[15px] text-slate-600 leading-relaxed whitespace-pre-wrap">{viewAnn.message}</p>
                {viewAnn.photo_url && (
                  <img src={viewAnn.photo_url} alt="" className="w-full rounded-xl object-cover"
                    loading="lazy" decoding="async" style={{ maxHeight: 300 }} />
                )}
              </div>
              <div className="flex gap-3 px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                <button onClick={() => { setViewAnn(null); setEditing(viewAnn); setShowModal(true) }}
                  className="flex-1 h-10 rounded-xl font-medium text-[14px] flex items-center justify-center gap-1.5"
                  style={{ background: 'rgba(0,0,0,0.05)', color: '#1e1b4b' }}>
                  <Pencil size={14} /> Edit
                </button>
                <button onClick={() => { setViewAnn(null); setDeleteTarget(viewAnn) }}
                  className="flex-1 h-10 rounded-xl font-medium text-[14px] flex items-center justify-center gap-1.5"
                  style={{ background: 'rgba(255,59,48,0.07)', color: '#ef4444', border: '1px solid rgba(255,59,48,0.15)' }}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {showModal && (
        <AnnouncementModal
          ann={editing}
          onClose={() => { setShowModal(false); setEditing(undefined) }}
          onSaved={init}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative w-full max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', boxShadow: '0 -4px 40px rgba(0,0,0,0.15)' }}>
            <div className="w-10 h-1 rounded-full mx-auto mt-3 sm:hidden" style={{ background: 'rgba(0,0,0,0.12)' }} />

            {/* Icon + heading */}
            <div className="flex flex-col items-center pt-8 pb-5 px-6 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                style={{ background: 'rgba(255,59,48,0.1)', border: '2px solid rgba(255,59,48,0.18)' }}>
                <Trash2 size={22} style={{ color: '#FF3B30' }} />
              </div>
              <h3 className="text-[19px] font-bold text-[#1e1b4b] mb-1.5">Delete Announcement?</h3>
              <p className="text-[14px] text-slate-400 leading-relaxed">
                This will permanently remove
              </p>
              <p className="text-[14px] font-semibold text-[#1e1b4b] mt-0.5 px-4 line-clamp-2">
                "{deleteTarget.title}"
              </p>
              <p className="text-[13px] text-slate-400 mt-1">This action cannot be undone.</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-6 pb-8">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 h-11 rounded-xl font-semibold text-[15px] transition-all disabled:opacity-50"
                style={{ background: 'rgba(0,0,0,0.06)', color: '#1e1b4b' }}>
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 h-11 rounded-xl font-semibold text-[15px] text-white transition-all disabled:opacity-50"
                style={{ background: '#FF3B30', boxShadow: '0 4px 12px rgba(255,59,48,0.3)' }}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
