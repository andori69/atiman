// @ts-nocheck
// Lost & Found — shared between landlords and renters
//
// ─── Run ALL of these in Supabase SQL Editor ──────────────────────────────────
//
// IMPORTANT — Run this in Supabase SQL Editor to set up the storage bucket + policies:
//
// INSERT INTO storage.buckets (id, name, public)
// VALUES ('lost-found', 'lost-found', true)
// ON CONFLICT (id) DO UPDATE SET public = true;
//
// CREATE POLICY "lost_found_upload" ON storage.objects
//   FOR INSERT TO authenticated
//   WITH CHECK (bucket_id = 'lost-found');
//
// CREATE POLICY "lost_found_read" ON storage.objects
//   FOR SELECT TO public
//   USING (bucket_id = 'lost-found');
//
// CREATE POLICY "lost_found_delete" ON storage.objects
//   FOR DELETE TO authenticated
//   USING (bucket_id = 'lost-found' AND auth.uid() = owner);
//
//
// -- Core tables (skip if already created):
// CREATE TABLE IF NOT EXISTS lost_found_posts ( ... );  -- see previous migration
// CREATE TABLE IF NOT EXISTS lost_found_responses ( ... );
//
// -- New columns needed for this version:
// ALTER TABLE lost_found_posts    ADD COLUMN IF NOT EXISTS poster_name text;
// ALTER TABLE lost_found_posts    ADD COLUMN IF NOT EXISTS poster_room text;
// ALTER TABLE lost_found_responses ADD COLUMN IF NOT EXISTS photos text[];
// ALTER TABLE lost_found_responses ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected'));
// ALTER TABLE lost_found_responses ADD COLUMN IF NOT EXISTS rejection_reason text;
// ALTER TABLE lost_found_responses ADD COLUMN IF NOT EXISTS finder_name text;
// ALTER TABLE lost_found_responses ADD COLUMN IF NOT EXISTS finder_room text;
// ALTER TABLE notifications        ADD COLUMN IF NOT EXISTS reference_id uuid;
//
// -- Allow all community members to read profile names (fixes "Unknown" in Lost & Found):
// DROP POLICY IF EXISTS "Community members can view profiles" ON profiles;
// CREATE POLICY "Community members can view profiles" ON profiles
//   FOR SELECT USING (auth.uid() IS NOT NULL);
//
// -- Fix notifications INSERT policy so any authenticated user can notify others:
// DROP POLICY IF EXISTS "Authenticated can insert notifications" ON notifications;
// CREATE POLICY "Authenticated can insert notifications" ON notifications
//   FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
//
// -- Fix notifications SELECT so users only see their own:
// DROP POLICY IF EXISTS "Users read own notifications" ON notifications;
// CREATE POLICY "Users read own notifications" ON notifications
//   FOR SELECT USING (user_id = auth.uid());
//
// -- lost_found_responses policies (REQUIRED for reject/accept to work):
// ALTER TABLE lost_found_responses ENABLE ROW LEVEL SECURITY;
// DROP POLICY IF EXISTS "Authenticated can view responses" ON lost_found_responses;
// CREATE POLICY "Authenticated can view responses" ON lost_found_responses
//   FOR SELECT USING (auth.uid() IS NOT NULL);
// DROP POLICY IF EXISTS "Authenticated can insert responses" ON lost_found_responses;
// CREATE POLICY "Authenticated can insert responses" ON lost_found_responses
//   FOR INSERT WITH CHECK (auth.uid() = user_id);
// DROP POLICY IF EXISTS "Post owner or self can update response" ON lost_found_responses;
// CREATE POLICY "Post owner or self can update response" ON lost_found_responses
//   FOR UPDATE USING (
//     user_id = auth.uid() OR
//     (SELECT user_id FROM lost_found_posts WHERE id = post_id) = auth.uid()
//   );
// -- lost_found_posts policies:
// ALTER TABLE lost_found_posts ENABLE ROW LEVEL SECURITY;
// DROP POLICY IF EXISTS "Authenticated can view posts" ON lost_found_posts;
// CREATE POLICY "Authenticated can view posts" ON lost_found_posts
//   FOR SELECT USING (auth.uid() IS NOT NULL);
// DROP POLICY IF EXISTS "Authenticated can insert posts" ON lost_found_posts;
// CREATE POLICY "Authenticated can insert posts" ON lost_found_posts
//   FOR INSERT WITH CHECK (auth.uid() = user_id);
// DROP POLICY IF EXISTS "Post owner can update post" ON lost_found_posts;
// CREATE POLICY "Post owner can update post" ON lost_found_posts
//   FOR UPDATE USING (user_id = auth.uid());
// DROP POLICY IF EXISTS "Post owner can delete post" ON lost_found_posts;
// CREATE POLICY "Post owner can delete post" ON lost_found_posts
//   FOR DELETE USING (user_id = auth.uid());

import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Package2, CheckCircle2, Plus, X, Search,
  ImagePlus, Trash2, Camera, Clock, AlertCircle,
  ZoomIn, Bell, Check, Edit3, ThumbsUp, ThumbsDown, ChevronRight,
  MapPin,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { timeAgo } from '@/lib/utils'

// ─── Design tokens ────────────────────────────────────────────────────────────
const GLASS = {
  background: 'rgba(255,255,255,0.22)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.45)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(108,92,231,0.06), 0 1px 1px rgba(255,255,255,0.5) inset',
}
const GLASS_MODAL = {
  background: 'rgba(255,255,255,0.97)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.7)',
  borderRadius: 20,
  boxShadow: '0 24px 64px rgba(100,80,200,0.18)',
}
const INPUT_BASE =
  'w-full h-11 rounded-xl px-4 text-[15px] text-[#1e1b4b] outline-none transition-all focus:ring-2 focus:ring-[#6C5CE7]/30'
const INPUT_STYLE = { background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.7)' }
const LABEL = 'block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5'
const ACCENT = '#6C5CE7'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#6C5CE7', '#00B894', '#E17055', '#0984E3', '#FDCB6E', '#A29BFE', '#55EFC4', '#FD79A8']

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

function avatarColor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function fmtDateTime(ts) {
  const d = new Date(ts)
  return (
    d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
  )
}

// ─── Status config ────────────────────────────────────────────────────────────
// 'lost'     = searching
// 'found'    = someone submitted a claim → "Pending Verification"
// 'resolved' = confirmed found
const STATUS_CFG = {
  lost:     { label: 'Lost',                 bg: 'rgba(239,68,68,0.1)',   color: '#dc2626', dot: '#ef4444' },
  found:    { label: 'Pending Verification',  bg: 'rgba(245,158,11,0.1)', color: '#d97706', dot: '#f59e0b' },
  resolved: { label: 'Resolved',             bg: 'rgba(34,197,94,0.1)',   color: '#16a34a', dot: '#22c55e' },
}

const CLAIM_STATUS_CFG = {
  pending:  { label: 'Awaiting review', bg: 'rgba(245,158,11,0.12)', color: '#d97706' },
  accepted: { label: 'Accepted ✓',      bg: 'rgba(34,197,94,0.1)',   color: '#16a34a' },
  rejected: { label: 'Not a match',     bg: 'rgba(239,68,68,0.1)',   color: '#dc2626' },
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 36 }) {
  return (
    <div className="flex items-center justify-center text-white font-semibold flex-shrink-0"
      style={{ width: size, height: size, borderRadius: '50%', background: avatarColor(name || '?'), fontSize: size * 0.38 }}>
      {initials(name || '?')}
    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const sc = STATUS_CFG[status] ?? STATUS_CFG.lost
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold flex-shrink-0"
      style={{ background: sc.bg, color: sc.color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
      {sc.label}
    </span>
  )
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ url, onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.92)' }} onClick={onClose}>
      <button className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all"
        onClick={onClose}>
        <X size={22} />
      </button>
      <img src={url} alt="" className="max-w-[92vw] max-h-[88vh] rounded-2xl object-contain shadow-2xl"
        onClick={e => e.stopPropagation()} />
    </div>
  )
}

// ─── Photo Strip ──────────────────────────────────────────────────────────────
function PhotoStrip({ urls, onZoom, size = 84 }) {
  if (!urls?.length) return null
  return (
    <div className="flex gap-2 flex-wrap">
      {urls.map((url, i) => (
        <button key={i} onClick={() => onZoom(url)}
          className="relative group rounded-xl overflow-hidden flex-shrink-0"
          style={{ width: size, height: size }}>
          <img src={url} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <ZoomIn size={18} color="#fff" />
          </div>
        </button>
      ))}
    </div>
  )
}

// ─── Notification Banner ──────────────────────────────────────────────────────
function NotifBanner({ notifs, onAcknowledge, onView, onClearAll }) {
  if (!notifs.length) return null
  return (
    <div className="mb-5 flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Notifications</span>
        <button onClick={onClearAll}
          className="text-[12px] font-medium text-slate-400 hover:text-slate-600 transition-colors">
          Clear all
        </button>
      </div>
      {notifs.map(n => (
        <div key={n.id} className="flex items-start gap-3 px-4 py-3 rounded-2xl"
          style={{ background: 'rgba(108,92,231,0.07)', border: '1px solid rgba(108,92,231,0.18)' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: 'rgba(108,92,231,0.12)' }}>
            <Bell size={16} color={ACCENT} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[#1e1b4b] leading-snug">{n.title}</p>
            <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">{n.message}</p>
            <p className="text-[11px] text-slate-400 mt-1">
              {new Date(n.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} · {new Date(n.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
            {n.reference_id && (
              <button onClick={() => onView(n.reference_id, n.id)}
                className="flex items-center gap-1 px-3 h-8 rounded-lg text-[12px] font-semibold text-white transition-all"
                style={{ background: ACCENT }}>
                View <ChevronRight size={12} />
              </button>
            )}
            <button onClick={() => onAcknowledge(n.id)}
              className="flex items-center gap-1 px-3 h-8 rounded-lg text-[12px] font-medium text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all">
              <Check size={12} /> Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Helper: fetch caller's active room number ─────────────────────────────────
async function fetchMyRoom(userId) {
  const { data } = await supabase
    .from('tenants')
    .select('rooms(room_number)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()
  return data?.rooms?.room_number ?? null
}

// ─── Helper: upload one image file → public URL ────────────────────────────────
async function uploadPhoto(file, prefix = 'posts') {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  let uploadResult = await supabase.storage.from('lost-found').upload(path, file, { upsert: true })

  // Auto-create bucket on first use and retry once
  if (uploadResult.error?.message?.toLowerCase().includes('bucket not found')) {
    await supabase.storage.createBucket('lost-found', { public: true })
    uploadResult = await supabase.storage.from('lost-found').upload(path, file, { upsert: true })
  }

  if (uploadResult.error) throw new Error(`Upload failed: ${uploadResult.error.message}`)
  const { data: pub } = supabase.storage.from('lost-found').getPublicUrl(uploadResult.data.path)
  return pub.publicUrl
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LostFound() {
  const { profile } = useAuth()
  const landlordId = profile?.role === 'landlord' ? profile.id : profile?.linked_landlord_id

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const [notifs, setNotifs] = useState([])

  const [selectedPost, setSelectedPost] = useState(null)
  const [claims, setClaims] = useState([])       // "found" type responses only
  const [claimsLoading, setClaimsLoading] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [editingPost, setEditingPost] = useState(null)
  const [showFoundIt, setShowFoundIt] = useState(false)

  const [lightboxUrl, setLightboxUrl] = useState(null)

  // Poster: add more photos
  const [showAddPhotos, setShowAddPhotos] = useState(false)
  const [addPhotoFiles, setAddPhotoFiles] = useState([])
  const [addPhotoPreviews, setAddPhotoPreviews] = useState([])
  const [addingPhotos, setAddingPhotos] = useState(false)

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Reject claim
  const [rejectingClaimId, setRejectingClaimId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [rejectError, setRejectError] = useState('')

  // ── Fetch posts (with poster name + room via join) ────────────────────────────
  const fetchPosts = useCallback(async () => {
    if (!landlordId) return
    setLoading(true)

    const { data: raw } = await supabase
      .from('lost_found_posts')
      .select('*')
      .eq('landlord_id', landlordId)
      .order('created_at', { ascending: false })

    if (!raw?.length) { setPosts([]); setLoading(false); return }

    // For posts that were created before poster_name was stored, fall back to a profile lookup
    const needsLookup = raw.filter(p => !p.poster_name).map(p => p.user_id)
    const nameByUser = {}
    const roomByUser = {}

    if (needsLookup.length) {
      const ids = [...new Set(needsLookup)]
      const [{ data: profileRows }, { data: tenantRows }] = await Promise.all([
        supabase.from('profiles').select('id, full_name').in('id', ids),
        supabase.from('tenants').select('user_id, rooms(room_number)').in('user_id', ids).eq('is_active', true),
      ])
      profileRows?.forEach(p => { nameByUser[p.id] = p.full_name })
      tenantRows?.forEach(t => { if (!roomByUser[t.user_id]) roomByUser[t.user_id] = t.rooms?.room_number })
    }

    setPosts(raw.map(p => ({
      ...p,
      display_name: p.poster_name || nameByUser[p.user_id] || 'Unknown',
      display_room: p.poster_room || (roomByUser[p.user_id] ? `Room ${roomByUser[p.user_id]}` : null),
    })))
    setLoading(false)
  }, [landlordId])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  // ── Fetch unread L&F notifications ──────────────────────────────────────────
  const fetchNotifs = useCallback(async () => {
    if (!profile?.id) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .eq('is_read', false)
      .in('notification_type', ['lost_found', 'lost_found_claim', 'lost_found_accepted', 'lost_found_rejected'])
      .order('created_at', { ascending: false })
    setNotifs(data ?? [])
  }, [profile?.id])

  useEffect(() => { fetchNotifs() }, [fetchNotifs])

  // ── Fetch "found" claims (with finder name + room via join) ──────────────────
  const fetchClaims = useCallback(async (postId) => {
    setClaimsLoading(true)

    const { data: raw } = await supabase
      .from('lost_found_responses')
      .select('*')
      .eq('post_id', postId)
      .eq('response_type', 'found')
      .order('created_at', { ascending: true })

    if (!raw?.length) { setClaims([]); setClaimsLoading(false); return }

    const finderIds = [...new Set(raw.map(r => r.user_id))]

    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', finderIds)
    const nameByUser = {}
    profileRows?.forEach(p => { nameByUser[p.id] = p.full_name })

    const { data: tenantRows } = await supabase
      .from('tenants')
      .select('user_id, rooms(room_number)')
      .in('user_id', finderIds)
      .eq('is_active', true)
    const roomByUser = {}
    tenantRows?.forEach(t => { if (!roomByUser[t.user_id]) roomByUser[t.user_id] = t.rooms?.room_number })

    setClaims(raw.map(r => ({
      ...r,
      display_name: nameByUser[r.user_id] || 'Anonymous',
      display_room: roomByUser[r.user_id] ? `Room ${roomByUser[r.user_id]}` : null,
    })))
    setClaimsLoading(false)
  }, [])

  useEffect(() => {
    if (selectedPost) fetchClaims(selectedPost.id)
    else setClaims([])
  }, [selectedPost, fetchClaims])

  // ── Realtime ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!landlordId) return
    const ch = supabase
      .channel('lf-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lost_found_posts' }, () => fetchPosts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lost_found_responses' }, () => {
        fetchPosts()
        if (selectedPost) fetchClaims(selectedPost.id)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => fetchNotifs())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
        fetchPosts()
        if (selectedPost) fetchClaims(selectedPost.id)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [landlordId, fetchPosts, fetchClaims, fetchNotifs, selectedPost])

  // ── Acknowledge notification ─────────────────────────────────────────────────
  async function acknowledgeNotif(id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifs(p => p.filter(n => n.id !== id))
  }

  async function clearAllNotifs() {
    if (!notifs.length) return
    await supabase.from('notifications').update({ is_read: true }).in('id', notifs.map(n => n.id))
    setNotifs([])
  }

  // ── View post from notification ──────────────────────────────────────────────
  async function viewPostFromNotif(postId, notifId) {
    acknowledgeNotif(notifId)
    const hit = posts.find(p => p.id === postId)
    if (hit) { openPost(hit); return }
    const { data } = await supabase.from('lost_found_posts').select('*').eq('id', postId).single()
    if (data) openPost(data)
  }

  // ── Open post detail ──────────────────────────────────────────────────────────
  function openPost(post) {
    setSelectedPost(post)
    setShowAddPhotos(false)
    setAddPhotoFiles([])
    setAddPhotoPreviews([])
    setDeleteConfirm(false)
    setRejectingClaimId(null)
    setRejectReason('')
    setShowFoundIt(false)
  }

  // ── Status update (post owner only) ──────────────────────────────────────────
  async function updateStatus(postId, newStatus) {
    await supabase
      .from('lost_found_posts')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', postId)
    setSelectedPost(p => p ? { ...p, status: newStatus } : null)
    await fetchPosts()
  }

  // ── Delete post ───────────────────────────────────────────────────────────────
  async function deletePost() {
    if (!selectedPost) return
    setDeleting(true)
    await supabase.from('lost_found_posts').delete().eq('id', selectedPost.id)
    setDeleting(false)
    setDeleteConfirm(false)
    setSelectedPost(null)
    await fetchPosts()
  }

  // ── Add more photos to post (poster only) ────────────────────────────────────
  function pickAddPhotos(e) {
    const files = Array.from(e.target.files)
    setAddPhotoFiles(p => [...p, ...files])
    files.forEach(f => {
      const r = new FileReader()
      r.onload = ev => setAddPhotoPreviews(p => [...p, ev.target.result])
      r.readAsDataURL(f)
    })
  }

  async function submitAddPhotos() {
    if (!addPhotoFiles.length || !selectedPost) return
    setAddingPhotos(true)
    try {
      const urls = await Promise.all(addPhotoFiles.map(f => uploadPhoto(f, 'lost-found/posts')))
      const allPhotos = [...(selectedPost.photos ?? []), ...urls]
      await supabase.from('lost_found_posts')
        .update({ photos: allPhotos, updated_at: new Date().toISOString() })
        .eq('id', selectedPost.id)
      setSelectedPost(p => p ? { ...p, photos: allPhotos } : null)
      await fetchPosts()
      setShowAddPhotos(false)
      setAddPhotoFiles([])
      setAddPhotoPreviews([])
    } finally {
      setAddingPhotos(false)
    }
  }

  // ── Accept a found claim ──────────────────────────────────────────────────────
  async function acceptClaim(claim) {
    await supabase.from('lost_found_responses').update({ status: 'accepted' }).eq('id', claim.id)
    await supabase.from('lost_found_posts')
      .update({ status: 'resolved', updated_at: new Date().toISOString() })
      .eq('id', selectedPost.id)
    await supabase.from('notifications').insert({
      user_id: claim.user_id,
      title: '🎉 Your finding was confirmed!',
      message: `${profile.full_name} confirmed that you found their lost item: "${selectedPost.item_name}". Thank you for helping the community!`,
      notification_type: 'lost_found_accepted',
      reference_id: selectedPost.id,
    })
    setSelectedPost(p => p ? { ...p, status: 'resolved' } : null)
    await fetchClaims(selectedPost.id)
    await fetchPosts()
  }

  // ── Reject a found claim ──────────────────────────────────────────────────────
  async function submitReject() {
    if (!rejectingClaimId) return
    setRejecting(true)
    setRejectError('')
    try {
      const claim = claims.find(c => c.id === rejectingClaimId)

      // Try with rejection_reason first; if that column doesn't exist yet, fall back
      let { error: updateErr } = await supabase.from('lost_found_responses')
        .update({ status: 'rejected', rejection_reason: rejectReason || null })
        .eq('id', rejectingClaimId)
      if (updateErr?.message?.includes('rejection_reason')) {
        const fallback = await supabase.from('lost_found_responses')
          .update({ status: 'rejected' })
          .eq('id', rejectingClaimId)
        updateErr = fallback.error
      }
      if (updateErr) throw new Error(updateErr.message)

      // Notify finder — try with reference_id, fallback without
      if (claim) {
        const notifBody = {
          user_id: claim.user_id,
          title: '❌ Claim not matched',
          message: `Your claim for "${selectedPost.item_name}" was reviewed — it's not a match. The post is still open. Feel free to look again or let others know!`,
          notification_type: 'lost_found_rejected',
        }
        const { error: n1 } = await supabase.from('notifications').insert({ ...notifBody, reference_id: selectedPost.id })
        if (n1) await supabase.from('notifications').insert(notifBody)
      }

      // Always revert post to 'lost' on rejection — stays open until owner marks resolved
      if (selectedPost.status !== 'resolved') {
        await updateStatus(selectedPost.id, 'lost')
      }
      setRejectingClaimId(null)
      setRejectReason('')
      await fetchClaims(selectedPost.id)
    } catch (e) {
      setRejectError(e.message ?? 'Failed to reject claim. Check that you have run the SQL migrations.')
    } finally {
      setRejecting(false)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const filteredPosts = posts.filter(p => {
    const mf = filter === 'all' || p.status === filter
    const ms = !search || p.item_name.toLowerCase().includes(search.toLowerCase())
    return mf && ms
  })

  const isPostOwner = selectedPost?.user_id === profile?.id
  const isResolved  = selectedPost?.status === 'resolved'
  // Only count an active claim — rejected ones let the user file again
  const myClaim     = selectedPost ? claims.find(c => c.user_id === profile?.id && (c.status ?? 'pending') !== 'rejected') : null
  const pendingClaims = claims.filter(c => (c.status ?? 'pending') === 'pending')

  // ─── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen px-4 py-6 md:px-8 md:py-8"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif" }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#1e1b4b]">Lost &amp; Found</h1>
          <p className="text-[14px] text-slate-400 mt-0.5">Community board for lost items</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 h-11 rounded-xl font-medium text-[14px] text-white transition-all active:scale-95"
          style={{ background: ACCENT, boxShadow: '0 4px 14px rgba(108,92,231,0.35)' }}>
          <Plus size={18} /> Post Item
        </button>
      </div>

      {/* Notification banner */}
      <NotifBanner notifs={notifs} onAcknowledge={acknowledgeNotif} onView={viewPostFromNotif} onClearAll={clearAllNotifs} />

      {/* Filter tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-1 p-1 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.5)' }}>
          {['all', 'lost', 'found', 'resolved'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-4 h-9 rounded-lg text-[13px] font-medium transition-all"
              style={filter === f
                ? { background: ACCENT, color: '#fff', boxShadow: '0 2px 8px rgba(108,92,231,0.3)' }
                : { color: '#64748b' }}>
              {f === 'all' ? 'All' : STATUS_CFG[f]?.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input type="text" placeholder="Search items…" value={search}
            onChange={e => setSearch(e.target.value)} className={INPUT_BASE + ' pl-9'} style={INPUT_STYLE} />
        </div>
      </div>

      {/* Posts grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl animate-pulse" style={{ ...GLASS, height: 168 }} />
          ))}
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(108,92,231,0.08)' }}>
            <Package2 size={32} color={ACCENT} />
          </div>
          <h2 className="text-[20px] font-semibold text-[#1e1b4b] mb-2">No posts yet</h2>
          <p className="text-[14px] text-slate-400 max-w-xs mb-6">
            Be the first to post a lost item in your community.
          </p>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 h-11 rounded-xl font-medium text-[14px] text-white"
            style={{ background: ACCENT }}>
            <Plus size={18} /> Post Item
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPosts.map(post => {
            const sc = STATUS_CFG[post.status] ?? STATUS_CFG.lost
            const pName = post.display_name || 'Unknown'
            return (
              <button key={post.id} onClick={() => openPost(post)}
                className="text-left rounded-2xl p-5 transition-all duration-200 hover:shadow-lg active:scale-[0.98]"
                style={GLASS}>
                <div className="flex items-center justify-between mb-3">
                  <StatusBadge status={post.status} />
                  {post.photos?.length > 0 && (
                    <span className="flex items-center gap-1 text-[12px] text-slate-400">
                      <Camera size={13} /> {post.photos.length}
                    </span>
                  )}
                </div>
                <h3 className="text-[16px] font-semibold text-[#1e1b4b] mb-1 leading-snug">{post.item_name}</h3>
                {post.description && (
                  <p className="text-[13px] text-slate-500 line-clamp-2 mb-3 leading-relaxed">{post.description}</p>
                )}
                <div className="flex items-center justify-between pt-2"
                  style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                  <div className="flex items-center gap-2">
                    <Avatar name={pName} size={26} />
                    <div>
                      <span className="text-[12px] font-semibold text-[#1e1b4b]">{pName}</span>
                      {post.display_room && (
                        <span className="text-[11px] text-slate-400 ml-1">· {post.display_room}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400">{timeAgo(post.created_at)}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Post Detail Modal ────────────────────────────────────────────────────── */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)' }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedPost(null) }}>
          <div className="w-full sm:max-w-2xl max-h-[94vh] overflow-y-auto"
            style={{ ...GLASS_MODAL, borderRadius: window.innerWidth < 640 ? '20px 20px 0 0' : 20 }}>

            {/* Drag bar */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>

            {/* Modal header */}
            <div className="flex items-center gap-3 px-6 pt-4 pb-4"
              style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-[18px] font-semibold text-[#1e1b4b] truncate">{selectedPost.item_name}</h2>
                  <StatusBadge status={selectedPost.status} />
                </div>
              </div>
              <button onClick={() => setSelectedPost(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-[#1e1b4b] hover:bg-slate-100 transition-all flex-shrink-0">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-5">

              {/* ── Poster info ── */}
              <div className="flex items-start gap-3">
                <Avatar name={selectedPost.display_name || 'Unknown'} size={42} />
                <div className="flex-1">
                  <p className="text-[15px] font-semibold text-[#1e1b4b]">
                    {selectedPost.display_name || 'Unknown'}
                  </p>
                  {selectedPost.display_room && (
                    <div className="flex items-center gap-1 text-[13px] text-slate-500 mt-0.5">
                      <MapPin size={12} />
                      <span>{selectedPost.display_room}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-[12px] text-slate-400 mt-0.5">
                    <Clock size={12} />
                    <span>Posted {fmtDateTime(selectedPost.created_at)}</span>
                  </div>
                </div>
                {isPostOwner && !isResolved && (
                  <button onClick={() => { setEditingPost(selectedPost); setSelectedPost(null) }}
                    className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-[13px] font-medium text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all flex-shrink-0">
                    <Edit3 size={14} /> Edit
                  </button>
                )}
              </div>

              {/* ── Description ── */}
              {selectedPost.description && (
                <p className="text-[15px] text-[#1e1b4b] leading-relaxed">{selectedPost.description}</p>
              )}

              {/* ── Post photos (visible to all) ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className={LABEL + ' mb-0'}>
                    Photos {selectedPost.photos?.length ? `(${selectedPost.photos.length})` : ''}
                  </p>
                  {isPostOwner && !isResolved && (
                    <button onClick={() => setShowAddPhotos(v => !v)}
                      className="flex items-center gap-1 text-[12px] font-medium transition-colors"
                      style={{ color: ACCENT }}>
                      <Plus size={13} /> Add Photos
                    </button>
                  )}
                </div>
                {selectedPost.photos?.length > 0
                  ? <PhotoStrip urls={selectedPost.photos} onZoom={setLightboxUrl} size={92} />
                  : <p className="text-[13px] text-slate-400">No photos attached.</p>
                }
                {/* Add photos form */}
                {showAddPhotos && (
                  <div className="mt-3 p-3 rounded-2xl flex flex-col gap-2"
                    style={{ background: 'rgba(108,92,231,0.04)', border: '1px solid rgba(108,92,231,0.12)' }}>
                    {addPhotoPreviews.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {addPhotoPreviews.map((src, i) => (
                          <div key={i} className="relative rounded-xl overflow-hidden" style={{ width: 64, height: 64 }}>
                            <img src={src} alt="" className="w-full h-full object-cover" />
                            <button onClick={() => {
                              setAddPhotoFiles(p => p.filter((_, j) => j !== i))
                              setAddPhotoPreviews(p => p.filter((_, j) => j !== i))
                            }} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center">
                              <X size={9} color="#fff" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <label className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-[13px] font-medium text-slate-500 border border-slate-200 cursor-pointer hover:bg-slate-50 transition-all">
                        <ImagePlus size={14} /> Choose
                        <input type="file" accept="image/*" multiple className="hidden" onChange={pickAddPhotos} />
                      </label>
                      {addPhotoFiles.length > 0 && (
                        <button onClick={submitAddPhotos} disabled={addingPhotos}
                          className="flex items-center gap-1.5 px-4 h-9 rounded-xl text-[13px] font-semibold text-white disabled:opacity-50 transition-all"
                          style={{ background: ACCENT }}>
                          {addingPhotos ? 'Uploading…' : `Upload ${addPhotoFiles.length} photo${addPhotoFiles.length > 1 ? 's' : ''}`}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Owner manage panel ── */}
              {isPostOwner && (
                <div className="p-4 rounded-2xl flex flex-col gap-3"
                  style={{ background: 'rgba(248,247,255,0.9)', border: '1px solid rgba(108,92,231,0.1)' }}>
                  <p className={LABEL + ' mb-0'}>Manage Post</p>
                  <div className="flex flex-wrap gap-2">
                    {!isResolved && (
                      <button onClick={() => updateStatus(selectedPost.id, 'lost')}
                        className="flex items-center gap-1.5 px-4 h-9 rounded-xl text-[13px] font-medium transition-all border"
                        style={selectedPost.status === 'lost'
                          ? { background: STATUS_CFG.lost.bg, color: STATUS_CFG.lost.color, borderColor: STATUS_CFG.lost.dot + '80' }
                          : { background: 'transparent', color: '#94a3b8', borderColor: '#e2e8f0' }}>
                        Mark Lost
                      </button>
                    )}
                    <button onClick={() => updateStatus(selectedPost.id, 'resolved')}
                      className="flex items-center gap-1.5 px-4 h-9 rounded-xl text-[13px] font-medium transition-all border"
                      style={isResolved
                        ? { background: STATUS_CFG.resolved.bg, color: STATUS_CFG.resolved.color, borderColor: STATUS_CFG.resolved.dot + '80' }
                        : { background: 'transparent', color: '#94a3b8', borderColor: '#e2e8f0' }}>
                      Mark Resolved
                    </button>
                    {!deleteConfirm && (
                      <button onClick={() => setDeleteConfirm(true)}
                        className="ml-auto flex items-center gap-1.5 px-3 h-9 rounded-xl text-[13px] font-medium text-red-500 border border-red-200 hover:bg-red-50 transition-all">
                        <Trash2 size={14} /> Delete
                      </button>
                    )}
                  </div>
                  {deleteConfirm && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                      style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <p className="flex-1 text-[13px] text-red-700 font-medium">Permanently delete this post?</p>
                      <button onClick={() => setDeleteConfirm(false)}
                        className="px-3 h-8 rounded-lg text-[12px] font-medium text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all">
                        Cancel
                      </button>
                      <button onClick={deletePost} disabled={deleting}
                        className="px-3 h-8 rounded-lg text-[12px] font-semibold text-white disabled:opacity-60 transition-all"
                        style={{ background: '#dc2626' }}>
                        {deleting ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }} />

              {/* ── Found claims (visible + reviewable by owner) ── */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-[15px] font-semibold text-[#1e1b4b]">
                    Finder Claims
                    {claims.length > 0 && (
                      <span className="ml-1.5 text-slate-400 font-normal">({claims.length})</span>
                    )}
                  </h3>
                  {pendingClaims.length > 0 && isPostOwner && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{ background: 'rgba(245,158,11,0.12)', color: '#d97706' }}>
                      {pendingClaims.length} to review
                    </span>
                  )}
                </div>

                {claimsLoading ? (
                  <div className="flex flex-col gap-3">
                    {[...Array(2)].map((_, i) => <div key={i} className="h-20 rounded-2xl animate-pulse bg-slate-100" />)}
                  </div>
                ) : claims.length === 0 ? (
                  <p className="text-[13px] text-slate-400 py-2 text-center">
                    No claims yet. Someone may still spot it!
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {claims.map(claim => {
                      const claimStatus = claim.status ?? 'pending'
                      const csc = CLAIM_STATUS_CFG[claimStatus]
                      const isRejecting = rejectingClaimId === claim.id
                      const finderName = claim.display_name || 'Anonymous'
                      return (
                        <div key={claim.id} className="rounded-2xl p-4"
                          style={
                            claimStatus === 'accepted'
                              ? { background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)' }
                              : claimStatus === 'rejected'
                                ? { background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)' }
                                : { background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.18)' }
                          }>
                          {/* Finder info */}
                          <div className="flex items-start gap-2 mb-3">
                            <Avatar name={finderName} size={34} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[13px] font-semibold text-[#1e1b4b]">{finderName}</span>
                                {claim.display_room && (
                                  <span className="flex items-center gap-1 text-[12px] text-slate-500">
                                    <MapPin size={11} /> {claim.display_room}
                                  </span>
                                )}
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ml-auto"
                                  style={{ background: csc.bg, color: csc.color }}>
                                  {csc.label}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">{timeAgo(claim.created_at)}</p>
                            </div>
                          </div>
                          {/* Message */}
                          {claim.message && (
                            <p className="text-[13px] text-slate-600 mb-3 leading-relaxed">{claim.message}</p>
                          )}
                          {/* Rejection reason */}
                          {claim.rejection_reason && claimStatus === 'rejected' && (
                            <p className="text-[12px] text-red-500 mb-3 italic">Reason: {claim.rejection_reason}</p>
                          )}
                          {/* Photos */}
                          {claim.photos?.length > 0 && (
                            <div className="mb-3">
                              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Evidence Photos</p>
                              <PhotoStrip urls={claim.photos} onZoom={setLightboxUrl} size={72} />
                            </div>
                          )}
                          {/* Accept / Reject for post owner */}
                          {isPostOwner && claimStatus === 'pending' && !isRejecting && !isResolved && (
                            <div className="flex items-center gap-2 pt-3"
                              style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                              <span className="text-[12px] text-slate-500 mr-auto">Is this your item?</span>
                              <button onClick={() => acceptClaim(claim)}
                                className="flex items-center gap-1.5 px-4 h-9 rounded-xl text-[13px] font-semibold text-white transition-all active:scale-95"
                                style={{ background: '#16a34a', boxShadow: '0 2px 8px rgba(22,163,74,0.25)' }}>
                                <ThumbsUp size={14} /> Accept
                              </button>
                              <button onClick={() => { setRejectingClaimId(claim.id); setRejectReason('') }}
                                className="flex items-center gap-1.5 px-4 h-9 rounded-xl text-[13px] font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-all">
                                <ThumbsDown size={14} /> Reject
                              </button>
                            </div>
                          )}
                          {/* Reject form */}
                          {isRejecting && (
                            <div className="flex flex-col gap-2 pt-3"
                              style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                              <input type="text" placeholder="Reason (optional)…"
                                value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                                className="w-full h-10 rounded-xl px-3 text-[13px] text-[#1e1b4b] outline-none"
                                style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }} />
                              {rejectError && (
                                <p className="text-[11px] text-red-500 leading-snug">{rejectError}</p>
                              )}
                              <div className="flex gap-2">
                                <button onClick={() => { setRejectingClaimId(null); setRejectError('') }}
                                  className="flex-1 h-9 rounded-xl text-[13px] font-medium text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all">
                                  Cancel
                                </button>
                                <button onClick={submitReject} disabled={rejecting}
                                  className="flex-1 h-9 rounded-xl text-[13px] font-semibold text-white disabled:opacity-50 transition-all"
                                  style={{ background: '#dc2626' }}>
                                  {rejecting ? 'Rejecting…' : 'Confirm Reject'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ── "Found It" button (non-owners, non-resolved) ── */}
              {!isPostOwner && !isResolved && (
                <div className="pb-2">
                  {myClaim ? (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-2xl text-[13px]"
                      style={{ background: 'rgba(108,92,231,0.06)', border: '1px solid rgba(108,92,231,0.15)' }}>
                      <CheckCircle2 size={15} color={ACCENT} />
                      <div className="flex-1">
                        <span className="font-medium text-[#1e1b4b]">You've filed a claim.</span>
                        <span className="text-slate-400 ml-1">
                          {(myClaim.status ?? 'pending') === 'pending' ? 'Awaiting review by the owner.' : ''}
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ background: CLAIM_STATUS_CFG[myClaim.status ?? 'pending'].bg, color: CLAIM_STATUS_CFG[myClaim.status ?? 'pending'].color }}>
                        {CLAIM_STATUS_CFG[myClaim.status ?? 'pending'].label}
                      </span>
                    </div>
                  ) : (
                    <button onClick={() => setShowFoundIt(true)}
                      className="w-full h-12 rounded-2xl font-semibold text-[15px] text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                      style={{ background: '#16a34a', boxShadow: '0 4px 14px rgba(22,163,74,0.3)' }}>
                      <CheckCircle2 size={20} /> I Found This Item
                    </button>
                  )}
                </div>
              )}

              {/* Resolved state */}
              {isResolved && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl text-[13px] font-medium"
                  style={{ background: 'rgba(34,197,94,0.08)', color: '#15803d', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <CheckCircle2 size={16} /> This item has been found and resolved.
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ── Found It Modal ─────────────────────────────────────────────────────── */}
      {showFoundIt && selectedPost && (
        <FoundItModal
          post={selectedPost}
          profile={profile}
          onClose={() => setShowFoundIt(false)}
          onSubmitted={async () => {
            setShowFoundIt(false)
            await fetchClaims(selectedPost.id)
            await fetchPosts()
            setSelectedPost(p => p ? { ...p, status: 'found' } : null)
          }}
        />
      )}

      {/* ── Create Post Modal ──────────────────────────────────────────────────── */}
      {showCreate && (
        <CreatePostModal
          profile={profile}
          landlordId={landlordId}
          onClose={() => setShowCreate(false)}
          onCreated={fetchPosts}
        />
      )}

      {/* ── Edit Post Modal ────────────────────────────────────────────────────── */}
      {editingPost && (
        <EditPostModal
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSaved={async (updated) => {
            setEditingPost(null)
            await fetchPosts()
            setSelectedPost(updated)
          }}
        />
      )}

      {/* ── Lightbox ──────────────────────────────────────────────────────────── */}
      {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  )
}

// ─── FoundItModal ─────────────────────────────────────────────────────────────
function FoundItModal({ post, profile, onClose, onSubmitted }) {
  const [photos, setPhotos] = useState([])
  const [previews, setPreviews] = useState([])
  const [message, setMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  function pickPhotos(e) {
    const files = Array.from(e.target.files)
    setPhotos(p => [...p, ...files])
    files.forEach(f => {
      const r = new FileReader()
      r.onload = ev => setPreviews(p => [...p, ev.target.result])
      r.readAsDataURL(f)
    })
  }

  async function handleSubmit() {
    if (!photos.length) { setError('Please upload at least one photo as proof.'); return }
    setUploading(true); setError('')
    try {
      // Get finder room
      const finderRoom = await fetchMyRoom(profile.id)

      // Upload photos
      const urls = await Promise.all(photos.map(f => uploadPhoto(f, 'lost-found/claims')))

      // Insert response — check error explicitly so photo column issues surface
      const { error: respErr } = await supabase.from('lost_found_responses').insert({
        post_id: post.id,
        user_id: profile.id,
        response_type: 'found',
        message: message.trim() || null,
        photos: urls,
      })
      if (respErr) throw new Error(respErr.message)

      // Auto-update post status to "found" (Pending Verification)
      await supabase.from('lost_found_posts')
        .update({ status: 'found', updated_at: new Date().toISOString() })
        .eq('id', post.id)

      // Notify original poster + thank finder
      const roomLabel = finderRoom ? ` (Room ${finderRoom})` : ''
      const notifRows = []
      if (post.user_id !== profile.id) {
        notifRows.push({
          user_id: post.user_id,
          title: '🎯 Someone may have found your item!',
          message: `${profile.full_name}${roomLabel} filed a claim for "${post.item_name}" with photo evidence. Open the post to review.`,
          notification_type: 'lost_found_claim',
        })
      }
      notifRows.push({
        user_id: profile.id,
        title: '🙏 Claim filed!',
        message: `Thanks for helping out! Your claim for "${post.item_name}" has been sent to the owner. They'll review your photos and get back to you.`,
        notification_type: 'lost_found_claim',
      })
      const { error: nErr } = await supabase.from('notifications').insert(
        notifRows.map(r => ({ ...r, reference_id: post.id }))
      )
      if (nErr) {
        await supabase.from('notifications').insert(notifRows)
      }

      onSubmitted()
    } catch (e) {
      setError(e.message ?? 'Something went wrong.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full sm:max-w-md overflow-y-auto"
        style={{ ...GLASS_MODAL, maxHeight: '90vh', borderRadius: window.innerWidth < 640 ? '20px 20px 0 0' : 20 }}>
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>
        <div className="flex items-center justify-between px-6 pt-4 pb-3"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
          <div>
            <h2 className="text-[18px] font-semibold text-[#1e1b4b]">I Found This Item</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">Upload photo evidence for the owner to review</p>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#1e1b4b] hover:bg-slate-100 transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {/* Item reference */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(108,92,231,0.06)', border: '1px solid rgba(108,92,231,0.12)' }}>
            <Package2 size={18} color={ACCENT} />
            <div>
              <p className="text-[13px] font-semibold text-[#1e1b4b]">{post.item_name}</p>
              {post.display_name && (
                <p className="text-[11px] text-slate-400">Posted by {post.display_name}</p>
              )}
            </div>
          </div>

          {/* Photo upload */}
          <div>
            <label className={LABEL}>
              Photo Evidence <span className="normal-case font-normal text-red-500">* required</span>
            </label>
            {previews.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-3">
                {previews.map((src, i) => (
                  <div key={i} className="relative rounded-xl overflow-hidden" style={{ width: 80, height: 80 }}>
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => {
                      setPhotos(p => p.filter((_, j) => j !== i))
                      setPreviews(p => p.filter((_, j) => j !== i))
                    }} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                      <X size={10} color="#fff" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="flex items-center justify-center gap-2 h-24 rounded-2xl text-[14px] font-medium text-slate-500 border-2 border-dashed border-slate-200 cursor-pointer hover:border-green-400 hover:text-green-600 transition-all"
              style={{ background: 'rgba(255,255,255,0.5)' }}>
              <ImagePlus size={20} />
              {previews.length ? `${previews.length} photo${previews.length > 1 ? 's' : ''} selected — add more` : 'Tap to upload photos'}
              <input type="file" accept="image/*" multiple className="hidden" onChange={pickPhotos} />
            </label>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Clear photos help the owner verify quickly. Show the item from multiple angles.
            </p>
          </div>

          {/* Message */}
          <div>
            <label className={LABEL}>Message <span className="normal-case font-normal">(optional)</span></label>
            <textarea rows={3}
              placeholder="Where did you find it? Any other details…"
              value={message} onChange={e => setMessage(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-[14px] text-[#1e1b4b] outline-none resize-none transition-all focus:ring-2 focus:ring-[#6C5CE7]/30"
              style={{ ...INPUT_STYLE, background: 'rgba(255,255,255,0.55)' }} />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] text-red-600"
              style={{ background: 'rgba(239,68,68,0.08)' }}>
              <AlertCircle size={15} /> {error}
            </div>
          )}

          <button onClick={handleSubmit} disabled={uploading || !photos.length}
            className="w-full h-12 rounded-xl font-semibold text-[15px] text-white transition-all disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2"
            style={{ background: '#16a34a', boxShadow: '0 4px 14px rgba(22,163,74,0.3)' }}>
            {uploading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Uploading…
              </>
            ) : (
              <><CheckCircle2 size={18} /> File Claim</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CreatePostModal ──────────────────────────────────────────────────────────
function CreatePostModal({ profile, landlordId, onClose, onCreated }) {
  const [itemName, setItemName] = useState('')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState([])
  const [previews, setPreviews] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function pickPhotos(e) {
    const files = Array.from(e.target.files)
    setPhotos(p => [...p, ...files])
    files.forEach(f => {
      const r = new FileReader()
      r.onload = ev => setPreviews(p => [...p, ev.target.result])
      r.readAsDataURL(f)
    })
  }

  async function handleSubmit() {
    if (!itemName.trim()) { setError('Item name is required.'); return }
    if (!profile || !landlordId) { setError('Profile not loaded.'); return }
    setSubmitting(true); setError('')
    try {
      // Get poster's room
      const posterRoom = await fetchMyRoom(profile.id)

      // Upload photos
      const urls = photos.length ? await Promise.all(photos.map(f => uploadPhoto(f, 'lost-found/posts'))) : []

      // Insert post — store name + room so readers never need a profile lookup
      const { data: post, error: err } = await supabase
        .from('lost_found_posts')
        .insert({
          user_id: profile.id,
          user_role: profile.role,
          landlord_id: landlordId,
          item_name: itemName.trim(),
          description: description.trim() || null,
          status: 'lost',
          photos: urls.length ? urls : null,
          poster_name: profile.full_name,
          poster_room: posterRoom ? `Room ${posterRoom}` : null,
        })
        .select()
        .single()

      if (err) { setError(err.message); setSubmitting(false); return }

      // Notify all community members (fire-and-forget — never block post creation)
      const targets = []
      if (profile.role === 'renter') {
        targets.push(landlordId)
        const { data: others } = await supabase.from('profiles').select('id')
          .eq('linked_landlord_id', landlordId).eq('status', 'approved').neq('id', profile.id)
        others?.forEach(r => targets.push(r.id))
      } else {
        const { data: renters } = await supabase.from('profiles').select('id')
          .eq('linked_landlord_id', landlordId).eq('status', 'approved')
        renters?.forEach(r => targets.push(r.id))
      }

      if (targets.length > 0) {
        const roomLabel = posterRoom ? ` (Room ${posterRoom})` : ''
        const snippet = description.trim().slice(0, 60) + (description.length > 60 ? '…' : '')
        const rows = targets.map(uid => ({
          user_id: uid,
          title: `🔍 Lost Item: ${itemName.trim()}`,
          message: `${profile.full_name}${roomLabel} is looking for: ${snippet || itemName.trim()}`,
          notification_type: 'lost_found',
        }))
        // Try with reference_id first; fall back without it if column missing
        const { error: n1 } = await supabase.from('notifications').insert(
          rows.map(r => ({ ...r, reference_id: post?.id ?? null }))
        )
        if (n1) {
          await supabase.from('notifications').insert(rows)
        }
      }

      onCreated()
      onClose()
    } catch (e) {
      setError(e.message ?? 'Something went wrong.')
      setSubmitting(false)
    }
  }

  return (
    <ModalShell onClose={onClose} title="Post a Lost Item">
      <div className="px-6 py-5 flex flex-col gap-4">
        <div>
          <label className={LABEL}>Item Name *</label>
          <input type="text" placeholder="e.g. Blue umbrella, iPhone charger…"
            value={itemName} onChange={e => setItemName(e.target.value)}
            className={INPUT_BASE} style={INPUT_STYLE} autoFocus />
        </div>
        <div>
          <label className={LABEL}>Description <span className="normal-case font-normal">(optional)</span></label>
          <textarea rows={3}
            placeholder="Where did you last see it? Identifying features?"
            value={description} onChange={e => setDescription(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-[15px] text-[#1e1b4b] outline-none resize-none transition-all focus:ring-2 focus:ring-[#6C5CE7]/30"
            style={{ ...INPUT_STYLE, background: 'rgba(255,255,255,0.55)' }} />
        </div>
        <div>
          <label className={LABEL}>Photos <span className="normal-case font-normal">(optional)</span></label>
          {previews.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-2">
              {previews.map((src, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden" style={{ width: 72, height: 72 }}>
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => {
                    setPhotos(p => p.filter((_, j) => j !== i))
                    setPreviews(p => p.filter((_, j) => j !== i))
                  }} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                    <X size={10} color="#fff" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 px-4 h-11 rounded-xl text-[14px] font-medium text-slate-500 border-2 border-dashed border-slate-200 cursor-pointer hover:border-[#6C5CE7]/50 hover:text-[#6C5CE7] transition-all"
            style={{ background: 'rgba(255,255,255,0.4)' }}>
            <ImagePlus size={18} /> Add Photos
            <input type="file" accept="image/*" multiple className="hidden" onChange={pickPhotos} />
          </label>
        </div>
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] text-red-600"
            style={{ background: 'rgba(239,68,68,0.08)' }}>
            <AlertCircle size={15} /> {error}
          </div>
        )}
        <button onClick={handleSubmit} disabled={submitting}
          className="w-full h-12 rounded-xl font-semibold text-[15px] text-white transition-all disabled:opacity-60 active:scale-[0.98]"
          style={{ background: ACCENT, boxShadow: '0 4px 14px rgba(108,92,231,0.3)' }}>
          {submitting ? 'Posting…' : 'Post Item'}
        </button>
      </div>
    </ModalShell>
  )
}

// ─── EditPostModal ─────────────────────────────────────────────────────────────
function EditPostModal({ post, onClose, onSaved }) {
  const [itemName, setItemName] = useState(post.item_name ?? '')
  const [description, setDescription] = useState(post.description ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!itemName.trim()) { setError('Item name is required.'); return }
    setSubmitting(true); setError('')
    try {
      const { data, error: err } = await supabase
        .from('lost_found_posts')
        .update({ item_name: itemName.trim(), description: description.trim() || null, updated_at: new Date().toISOString() })
        .eq('id', post.id)
        .select('*')
        .single()
      if (err) { setError(err.message); setSubmitting(false); return }
      // Merge back the poster info we already have
      onSaved({ ...data, display_name: post.display_name, display_room: post.display_room })
    } catch (e) {
      setError(e.message ?? 'Something went wrong.')
      setSubmitting(false)
    }
  }

  return (
    <ModalShell onClose={onClose} title="Edit Post">
      <div className="px-6 py-5 flex flex-col gap-4">
        <div>
          <label className={LABEL}>Item Name *</label>
          <input type="text" value={itemName} onChange={e => setItemName(e.target.value)}
            className={INPUT_BASE} style={INPUT_STYLE} autoFocus />
        </div>
        <div>
          <label className={LABEL}>Description <span className="normal-case font-normal">(optional)</span></label>
          <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-[15px] text-[#1e1b4b] outline-none resize-none transition-all focus:ring-2 focus:ring-[#6C5CE7]/30"
            style={{ ...INPUT_STYLE, background: 'rgba(255,255,255,0.55)' }} />
        </div>
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] text-red-600"
            style={{ background: 'rgba(239,68,68,0.08)' }}>
            <AlertCircle size={15} /> {error}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 h-12 rounded-xl font-medium text-[14px] text-slate-600 border border-slate-200 hover:bg-slate-50 transition-all">
            Cancel
          </button>
          <button onClick={handleSave} disabled={submitting}
            className="flex-1 h-12 rounded-xl font-semibold text-[15px] text-white transition-all disabled:opacity-60"
            style={{ background: ACCENT }}>
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

// ─── ModalShell ───────────────────────────────────────────────────────────────
function ModalShell({ children, title, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full sm:max-w-md overflow-y-auto"
        style={{ ...GLASS_MODAL, maxHeight: '90vh', borderRadius: window.innerWidth < 640 ? '20px 20px 0 0' : 20 }}>
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>
        <div className="flex items-center justify-between px-6 pt-4 pb-3"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <h2 className="text-[18px] font-semibold text-[#1e1b4b]">{title}</h2>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#1e1b4b] hover:bg-slate-100 transition-all">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
