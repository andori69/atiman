// @ts-nocheck
import { useEffect, useState, useRef } from 'react'
import { Phone, Copy, Check, Lock, LogOut, Shield, Building2, Eye, EyeOff, MapPin, AlertTriangle, RotateCcw, Trash2, Camera, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

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

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-4">{children}</p>
  )
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? ''}
        className={INPUT + ' pr-11'}
        style={INPUT_STYLE}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

const GLASS_MODAL = {
  background: 'rgba(255,255,255,0.96)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.65)',
  borderRadius: 20,
  boxShadow: '0 24px 64px rgba(100,80,200,0.18)',
}

function ResetRentalDataModal({ onClose, onDone, landlordId }: {
  onClose: () => void; onDone: () => void; landlordId: string
}) {
  const [step, setStep] = useState<'confirm' | 'working' | 'done'>('confirm')
  const [error, setError] = useState('')

  async function doReset() {
    setStep('working')
    try {
      // Get all building IDs for this landlord
      const { data: buildings } = await supabase.from('buildings').select('id').eq('landlord_id', landlordId)
      const buildingIds = (buildings ?? []).map((b: any) => b.id)

      // Get all renter profiles linked to this landlord
      const { data: linkedProfs } = await supabase.from('profiles').select('id').eq('linked_landlord_id', landlordId)
      const linkedUserIds = (linkedProfs ?? []).map((p: any) => p.id)

      // Get all tenant records for linked renters
      const { data: tenantRows } = linkedUserIds.length
        ? await supabase.from('tenants').select('id').in('user_id', linkedUserIds)
        : { data: [] }
      const tenantIds = (tenantRows ?? []).map((t: any) => t.id)

      // Delete all financial data in parallel
      await Promise.all([
        tenantIds.length
          ? supabase.from('payments').delete().in('tenant_id', tenantIds)
          : Promise.resolve(),
        buildingIds.length
          ? supabase.from('electricity_bills').delete().in('building_id', buildingIds)
          : Promise.resolve(),
        buildingIds.length
          ? supabase.from('expenses').delete().in('building_id', buildingIds)
          : Promise.resolve(),
        linkedUserIds.length
          ? supabase.from('notifications').delete()
              .in('user_id', linkedUserIds)
              .in('notification_type', ['payment_confirmed', 'payment_rejected', 'payment_submitted', 'rent_reminder', 'rent_overdue'])
          : Promise.resolve(),
      ])

      setStep('done')
    } catch (e: any) {
      setError(e.message ?? 'An error occurred.')
      setStep('confirm')
    }
  }

  if (step === 'done') {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onDone} />
        <div className="relative w-full max-w-sm p-6 text-center" style={GLASS_MODAL}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(52,199,89,0.1)', border: '2px solid rgba(52,199,89,0.25)' }}>
            <Check size={26} style={{ color: '#34C759' }} />
          </div>
          <h2 className="text-[20px] font-bold text-[#1e1b4b] mb-2">Data Reset Complete</h2>
          <p className="text-[13px] text-slate-400 mb-6 leading-relaxed">
            All rental transaction data has been cleared. Accounts, rooms, and settings remain intact.
          </p>
          <button onClick={onDone}
            className="w-full h-11 rounded-xl font-semibold text-[15px] text-white"
            style={{ background: 'rgba(52,199,89,0.88)', boxShadow: '0 4px 12px rgba(52,199,89,0.3)' }}>
            Done
          </button>
        </div>
      </div>
    )
  }

  if (step === 'working') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div className="relative w-full max-w-sm p-8 text-center" style={GLASS_MODAL}>
          <div className="w-12 h-12 rounded-full border-3 border-violet-200 border-t-violet-600 animate-spin mx-auto mb-5"
            style={{ borderWidth: 3 }} />
          <p className="text-[16px] font-semibold text-[#1e1b4b] mb-1">Resetting data…</p>
          <p className="text-[13px] text-slate-400">Please do not close this window.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm p-6" style={GLASS_MODAL}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[18px] font-bold text-[#1e1b4b]">Reset Rental Data?</h2>
            <p className="text-[12px] text-slate-400">This action cannot be undone</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.5)' }}>
            <Trash2 size={16} style={{ visibility: 'hidden' }} />
            ✕
          </button>
        </div>

        <div className="rounded-xl p-4 mb-4"
          style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <p className="text-[12px] font-semibold text-red-700 mb-2.5">This will permanently clear:</p>
          <div className="space-y-1.5">
            {[
              'Rent payments & payment history',
              'Electricity bills & payment history',
              'Expense records & reports',
              'Financial summaries & overdue records',
              'Payment-related notifications',
            ].map(item => (
              <div key={item} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                <p className="text-[12px] text-red-700">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl p-3.5 mb-5 flex items-start gap-2.5"
          style={{ background: 'rgba(52,199,89,0.06)', border: '1px solid rgba(52,199,89,0.18)' }}>
          <Check size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-emerald-700">
            Accounts, login credentials, rooms, tenant profiles, and settings will remain intact.
          </p>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2.5 rounded-xl text-[12px] text-red-600"
            style={{ background: 'rgba(255,59,48,0.08)' }}>{error}</div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 h-11 rounded-xl font-medium text-[15px] text-slate-500"
            style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.65)' }}>
            Cancel
          </button>
          <button onClick={doReset}
            className="flex-1 h-11 text-white rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2"
            style={{ background: 'rgba(239,68,68,0.88)', boxShadow: '0 4px 14px rgba(239,68,68,0.3)' }}>
            <RotateCcw size={15} /> Reset Data
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Settings() {
  const { profile, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()

  // Profile form — split full_name into first + last
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')

  // Boarding house / dorm name and address (stored in buildings)
  const [boardingHouseName, setBoardingHouseName] = useState('')
  const [boardingStreet, setBoardingStreet] = useState('')
  const [boardingBarangay, setBoardingBarangay] = useState('')
  const [boardingCity, setBoardingCity] = useState('')
  const [boardingProvince, setBoardingProvince] = useState('')
  const [buildingId, setBuildingId] = useState<string | null>(null)

  // Landlord code
  const [landlordCode, setLandlordCode] = useState(profile?.landlord_code ?? '')
  const [codeCopied, setCodeCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  // Password
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // Danger zone
  const [showResetModal, setShowResetModal] = useState(false)

  useEffect(() => {
    if (!profile) return
    const parts = (profile.full_name ?? '').split(' ')
    setFirstName(parts[0] ?? '')
    setLastName(parts.slice(1).join(' '))
    setPhone(profile.phone ?? '')
    setPhotoPreview(profile.avatar_url ?? '')
    setLandlordCode(profile.landlord_code ?? '')

    // Fetch the primary building
    supabase.from('buildings')
      .select('id, name, street, barangay, city, province')
      .eq('landlord_id', profile.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setBuildingId(data.id)
          setBoardingHouseName(data.name ?? '')
          setBoardingStreet(data.street ?? '')
          setBoardingBarangay(data.barangay ?? '')
          setBoardingCity(data.city ?? '')
          setBoardingProvince(data.province ?? '')
        }
      })
  }, [profile])

  async function saveProfile() {
    setProfileSaving(true); setProfileMsg('')

    let avatarUrl = profile?.avatar_url ?? null
    if (photoFile) {
      const ext = photoFile.name.split('.').pop()
      const path = `avatar-${profile!.id}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, photoFile, { upsert: true })
      if (uploadErr) {
        setProfileMsg('Failed to upload photo. Try again.')
        setProfileSaving(false)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      avatarUrl = publicUrl + `?t=${Date.now()}`
    }

    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')

    const { error } = await supabase.from('profiles').update({
      full_name: fullName || profile?.full_name,
      phone: phone || null,
      avatar_url: avatarUrl,
    }).eq('id', profile!.id)

    if (error) { setProfileMsg(error.message); setProfileSaving(false); return }

    // Save boarding house name and structured address
    if (buildingId) {
      await supabase.from('buildings').update({
        name: boardingHouseName.trim() || undefined,
        street: boardingStreet.trim() || null,
        barangay: boardingBarangay.trim() || null,
        city: boardingCity.trim() || null,
        province: boardingProvince.trim() || null,
      }).eq('id', buildingId)
    }

    await refreshProfile()
    setPhotoFile(null)
    setProfileMsg('Profile updated successfully.')
    setProfileSaving(false)
  }

  async function copyCode() {
    await navigator.clipboard.writeText(landlordCode)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  async function copyLink() {
    const link = `${window.location.origin}/register?code=${landlordCode}`
    await navigator.clipboard.writeText(link)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  async function changePassword() {
    setPasswordError(''); setPasswordMsg('')
    if (!currentPassword) { setPasswordError('Please enter your current password.'); return }
    if (!newPassword) { setPasswordError('Please enter a new password.'); return }
    if (newPassword.length < 6) { setPasswordError('New password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setPasswordError('New passwords do not match.'); return }
    if (newPassword === currentPassword) { setPasswordError('New password must differ from current password.'); return }

    setPasswordSaving(true)

    // Verify current password by re-authenticating
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: profile?.email ?? '',
      password: currentPassword,
    })
    if (authError) {
      setPasswordError('Current password is incorrect.')
      setPasswordSaving(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPasswordError(error.message)
    } else {
      setPasswordMsg('Password changed successfully.')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    }
    setPasswordSaving(false)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="space-y-6 w-full max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-[22px] sm:text-[28px] font-semibold tracking-tight text-[#1e1b4b]">Settings</h1>
        <p className="text-[13px] sm:text-[15px] text-slate-400 mt-0.5">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <div style={GLASS} className="p-6">
        <SectionHeader>Profile</SectionHeader>

        <div className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-[72px] h-[72px] rounded-full overflow-hidden flex items-center justify-center text-white text-xl font-bold"
                style={{ background: photoPreview ? undefined : 'rgba(108,92,231,0.85)', boxShadow: '0 4px 12px rgba(108,92,231,0.2)' }}>
                {photoPreview
                  ? <img src={photoPreview} className="w-full h-full object-cover" alt="" />
                  : <span>{[firstName, lastName].filter(Boolean).join(' ').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || 'L'}</span>
                }
              </div>
              <button onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-white transition-all"
                style={{ background: '#6C5CE7', boxShadow: '0 2px 8px rgba(108,92,231,0.35)' }}>
                <Camera size={13} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  setPhotoFile(f)
                  setPhotoPreview(URL.createObjectURL(f))
                }} />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[#1e1b4b]">
                {[firstName, lastName].filter(Boolean).join(' ') || profile?.full_name || 'Landlord'}
              </p>
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 text-[13px] font-medium mt-1 transition-all"
                style={{ color: '#6C5CE7' }}>
                <Upload size={12} />
                {photoPreview ? 'Change photo' : 'Upload photo'}
              </button>
            </div>
          </div>

          {/* First name / Last name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>First Name</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)}
                placeholder="Juan" className={INPUT} style={INPUT_STYLE} />
            </div>
            <div>
              <label className={LABEL}>Last Name</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)}
                placeholder="Dela Cruz" className={INPUT} style={INPUT_STYLE} />
            </div>
          </div>

          {/* Phone / Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="09XX XXX XXXX" className={INPUT} style={INPUT_STYLE} />
            </div>
            <div>
              <label className={LABEL}>Email</label>
              <input value={profile?.email ?? ''} disabled
                className={INPUT + ' opacity-50 cursor-not-allowed'} style={INPUT_STYLE} />
            </div>
          </div>

          {/* Boarding house name */}
          <div>
            <label className={LABEL}>Boarding House / Dorm Name</label>
            <div className="relative">
              <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                value={boardingHouseName}
                onChange={e => setBoardingHouseName(e.target.value)}
                placeholder="e.g. ATIMAN Boarding House"
                className={INPUT + ' pl-9'}
                style={INPUT_STYLE}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              This name appears on your dashboard, receipts, and announcements.
            </p>
          </div>

          {/* Address — 4 structured fields */}
          <div>
            <label className={LABEL}>Street Address</label>
            <div className="relative">
              <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                value={boardingStreet}
                onChange={e => setBoardingStreet(e.target.value)}
                placeholder="e.g. 123 Rizal St."
                className={INPUT + ' pl-9'}
                style={INPUT_STYLE}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Barangay</label>
              <input
                value={boardingBarangay}
                onChange={e => setBoardingBarangay(e.target.value)}
                placeholder="e.g. Barangay 1"
                className={INPUT}
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <label className={LABEL}>City / Municipality</label>
              <input
                value={boardingCity}
                onChange={e => setBoardingCity(e.target.value)}
                placeholder="e.g. Iligan City"
                className={INPUT}
                style={INPUT_STYLE}
              />
            </div>
          </div>
          <div>
            <label className={LABEL}>Province</label>
            <input
              value={boardingProvince}
              onChange={e => setBoardingProvince(e.target.value)}
              placeholder="e.g. Lanao del Norte"
              className={INPUT}
              style={INPUT_STYLE}
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              Used on receipts and official records.
            </p>
          </div>

          {profileMsg && (
            <p className={`text-[13px] font-medium ${profileMsg.includes('success') ? 'text-green-600' : 'text-red-500'}`}>
              {profileMsg}
            </p>
          )}

          <button onClick={saveProfile} disabled={profileSaving}
            className="h-11 px-6 rounded-xl text-white font-medium text-[14px] disabled:opacity-50 transition-all"
            style={{ background: 'rgba(108,92,231,0.85)', boxShadow: '0 4px 12px rgba(108,92,231,0.3)' }}>
            {profileSaving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* Landlord Code */}
      <div style={GLASS} className="p-6">
        <SectionHeader>Landlord Code</SectionHeader>
        <p className="text-[14px] text-slate-400 mb-4">
          Share this code with renters when they register. They'll link their account to you automatically.
          This code is permanent — keep it safe.
        </p>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-14 rounded-xl flex items-center px-5"
            style={{ background: 'rgba(108,92,231,0.08)', border: '2px solid rgba(108,92,231,0.2)' }}>
            <span className="text-[22px] font-bold tracking-widest text-[#6C5CE7] font-mono">
              {landlordCode || '—'}
            </span>
          </div>
          <button onClick={copyCode}
            className="h-14 px-4 rounded-xl flex items-center gap-2 text-[13px] font-medium transition-all"
            style={{
              background: codeCopied ? 'rgba(52,199,89,0.15)' : 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(255,255,255,0.7)',
              color: codeCopied ? '#15803d' : '#1e1b4b',
            }}>
            {codeCopied ? <Check size={15} /> : <Copy size={15} />}
            {codeCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <button onClick={copyLink}
          className="h-10 px-4 rounded-xl text-[13px] font-medium transition-all flex items-center gap-2"
          style={{
            background: linkCopied ? 'rgba(52,199,89,0.12)' : 'rgba(255,255,255,0.5)',
            border: '1px solid rgba(255,255,255,0.7)',
            color: linkCopied ? '#15803d' : '#1e1b4b',
          }}>
          {linkCopied ? <Check size={14} /> : <Copy size={14} />}
          {linkCopied ? 'Link copied!' : 'Copy invite link'}
        </button>
      </div>

      {/* Change Password */}
      <div style={GLASS} className="p-6">
        <SectionHeader>Security</SectionHeader>
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.15)' }}>
            <Lock size={14} className="text-[#6C5CE7]" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-[#1e1b4b]">Change Password</p>
            <p className="text-[12px] text-slate-400">Verify your current password before setting a new one</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className={LABEL}>Current Password</label>
            <PasswordInput value={currentPassword} onChange={setCurrentPassword} placeholder="Your current password" />
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.4)', paddingTop: 12 }}>
            <div className="space-y-3">
              <div>
                <label className={LABEL}>New Password</label>
                <PasswordInput value={newPassword} onChange={setNewPassword} placeholder="Min. 6 characters" />
              </div>
              <div>
                <label className={LABEL}>Confirm New Password</label>
                <PasswordInput value={confirmPassword} onChange={setConfirmPassword} placeholder="Repeat new password" />
              </div>
            </div>
          </div>

          {/* Password strength indicator */}
          {newPassword.length > 0 && (
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map(i => {
                const strength = newPassword.length >= 12 ? 4 : newPassword.length >= 8 ? 3 : newPassword.length >= 6 ? 2 : 1
                return (
                  <div key={i} className="flex-1 h-1 rounded-full transition-all"
                    style={{
                      background: i <= strength
                        ? strength === 4 ? '#10b981' : strength === 3 ? '#6C5CE7' : strength === 2 ? '#f59e0b' : '#ef4444'
                        : 'rgba(0,0,0,0.08)',
                    }} />
                )
              })}
              <span className="text-[11px] text-slate-400 whitespace-nowrap">
                {newPassword.length >= 12 ? 'Strong' : newPassword.length >= 8 ? 'Good' : newPassword.length >= 6 ? 'Fair' : 'Weak'}
              </span>
            </div>
          )}

          {passwordError && (
            <div className="px-4 py-3 rounded-xl text-[13px] text-red-600 flex items-center gap-2"
              style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.15)' }}>
              {passwordError}
            </div>
          )}
          {passwordMsg && (
            <div className="px-4 py-3 rounded-xl text-[13px] text-green-700 flex items-center gap-2"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
              {passwordMsg}
            </div>
          )}

          <button
            onClick={changePassword}
            disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
            className="h-11 px-6 rounded-xl text-white font-medium text-[14px] disabled:opacity-50 transition-all flex items-center gap-2"
            style={{ background: 'rgba(108,92,231,0.85)', boxShadow: '0 4px 12px rgba(108,92,231,0.3)' }}>
            <Shield size={15} />
            {passwordSaving ? 'Verifying…' : 'Update Password'}
          </button>
        </div>
      </div>

      {/* Account */}
      <div style={GLASS} className="p-6">
        <SectionHeader>Account</SectionHeader>
        <button onClick={handleSignOut}
          className="flex items-center gap-2 h-11 px-5 rounded-xl text-[14px] font-medium transition-all"
          style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)', color: '#dc2626' }}>
          <LogOut size={15} /> Sign Out
        </button>
      </div>

      {/* Danger Zone */}
      <div className="p-6 rounded-2xl" style={{ background: 'rgba(239,68,68,0.04)', border: '1.5px solid rgba(239,68,68,0.18)' }}>
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={14} className="text-red-500" />
          <p className="text-[11px] font-semibold uppercase tracking-widest text-red-500">Danger Zone</p>
        </div>
        <p className="text-[13px] text-slate-400 mb-5">
          Irreversible actions. Proceed with caution.
        </p>

        <div className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          style={{ background: 'rgba(255,255,255,0.35)', border: '1px solid rgba(239,68,68,0.12)' }}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <RotateCcw size={15} className="text-red-500" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#1e1b4b]">Reset Rental Data</p>
              <p className="text-[12px] text-slate-400 mt-0.5 leading-relaxed">
                Clear all payment history, electricity bills, and financial records. Start fresh for a new term.
                Accounts, rooms, and profiles are kept.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowResetModal(true)}
            className="flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-semibold whitespace-nowrap flex-shrink-0 transition-all"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#dc2626' }}>
            <RotateCcw size={13} /> Reset Data
          </button>
        </div>
      </div>

      {showResetModal && profile?.id && (
        <ResetRentalDataModal
          landlordId={profile.id}
          onClose={() => setShowResetModal(false)}
          onDone={() => setShowResetModal(false)}
        />
      )}
    </div>
  )
}
