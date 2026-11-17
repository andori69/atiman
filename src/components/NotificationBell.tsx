// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from 'react'
import { Bell, Check, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const ACCENT = '#6C5CE7'
const LF_TYPES = ['lost_found', 'lost_found_claim', 'lost_found_accepted', 'lost_found_rejected']

export default function NotificationBell({ onCountChange }: { onCountChange?: (n: number) => void }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [notifs, setNotifs] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  // Each mounted instance needs a unique channel name so Supabase doesn't conflict
  const channelId = useRef(`notif-bell-${Math.random().toString(36).slice(2)}`)

  const fetchNotifs = useCallback(async () => {
    if (!profile?.id) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .eq('is_read', false)
      .in('notification_type', LF_TYPES)
      .order('created_at', { ascending: false })
      .limit(15)
    const list = data ?? []
    setNotifs(list)
    onCountChange?.(list.length)
  }, [profile?.id])

  useEffect(() => { fetchNotifs() }, [fetchNotifs])

  useEffect(() => {
    if (!profile?.id) return
    const ch = supabase
      .channel(channelId.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetchNotifs)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile?.id, fetchNotifs])

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function dismiss(id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifs(p => {
      const next = p.filter(n => n.id !== id)
      onCountChange?.(next.length)
      return next
    })
  }

  async function dismissAll() {
    if (!notifs.length) return
    await supabase.from('notifications').update({ is_read: true }).in('id', notifs.map(n => n.id))
    setNotifs([])
    onCountChange?.(0)
  }

  function viewPost(notif) {
    dismiss(notif.id)
    const path = profile?.role === 'landlord' ? '/landlord/lost-found' : '/renter/lost-found'
    navigate(path)
    setOpen(false)
  }

  const count = notifs.length

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-[#1e1b4b] transition-all"
        style={{ background: open ? 'rgba(108,92,231,0.1)' : 'rgba(255,255,255,0.3)' }}
      >
        <Bell size={18} />
        {count > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center leading-none"
            style={{ boxShadow: '0 0 0 2px rgba(255,255,255,0.9)' }}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-11 w-80 rounded-2xl shadow-xl z-[200]"
          style={{
            background: 'rgba(255,255,255,0.97)',
            border: '1px solid rgba(108,92,231,0.12)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
            <span className="text-[13px] font-semibold text-[#1e1b4b]">Notifications</span>
            {count > 0 && (
              <button onClick={dismissAll}
                className="text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors">
                Clear all
              </button>
            )}
          </div>

          {/* Body */}
          {count === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell size={28} className="mx-auto mb-2 text-slate-300" />
              <p className="text-[13px] text-slate-400">You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50" style={{ maxHeight: 320, overflowY: 'auto' }}>
              {notifs.map(n => (
                <div key={n.id} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(108,92,231,0.1)' }}>
                    <Bell size={14} color={ACCENT} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-[#1e1b4b] leading-snug">{n.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {new Date(n.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} · {new Date(n.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0 mt-0.5">
                    {n.reference_id && (
                      <button onClick={() => viewPost(n)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white transition-all active:scale-95"
                        style={{ background: ACCENT }}>
                        <ChevronRight size={13} />
                      </button>
                    )}
                    <button onClick={() => dismiss(n.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 border border-slate-200 hover:bg-slate-100 transition-all">
                      <Check size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
