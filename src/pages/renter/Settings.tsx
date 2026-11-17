// @ts-nocheck
import { useEffect, useState, useRef } from 'react'
import { User, Phone, Lock, Upload, LogOut, Shield, MapPin, Eye, EyeOff, CheckCircle2, Camera } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

const GLASS = {
  background: 'rgba(255,255,255,0.28)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.45)',
  borderRadius: 16,
  boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
}

const LABEL = 'block text-[11px] font-semibold uppercase tracking-widest text-[#6E6E73] mb-1.5'
const INPUT_CLASS = 'w-full h-11 rounded-xl px-4 text-[15px] text-[#1D1D1F] outline-none transition-all focus:ring-2 focus:ring-[#0071E3] focus:bg-white'
const INPUT_STYLE = { background: '#F5F5F7', border: '1px solid rgba(0,0,0,0.04)' }

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-[#6E6E73] mb-4">{children}</p>
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
        className={INPUT_CLASS + ' pr-11'}
        style={INPUT_STYLE}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#AEAEB2] transition-colors"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

export default function RenterSettings() {
  const { profile, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')
  const [profileError, setProfileError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (!profile) return
    const parts = (profile.full_name ?? '').split(' ')
    setFirstName(parts[0] ?? '')
    setLastName(parts.slice(1).join(' '))
    setPhone(profile.phone ?? '')
    setPhotoPreview(profile.avatar_url ?? '')

    // Fetch address from profiles (may be extended column)
    supabase.from('profiles').select('address').eq('id', profile.id).maybeSingle()
      .then(({ data }) => { if (data?.address) setAddress(data.address) })
  }, [profile])

  async function saveProfile() {
    setProfileSaving(true); setProfileMsg(''); setProfileError('')

    let avatarUrl = profile?.avatar_url ?? null
    if (photoFile) {
      const ext = photoFile.name.split('.').pop()
      const path = `avatar-${profile!.id}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, photoFile, { upsert: true })
      if (uploadErr) {
        setProfileError('Failed to upload photo. Try again.')
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
      address: address || null,
    }).eq('id', profile!.id)

    if (error) { setProfileError(error.message); setProfileSaving(false); return }

    // Sync to the tenants row so the landlord immediately sees the updated
    // name, phone, and photo on their Renters page (landlord reads tenants, not profiles).
    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('id')
      .eq('user_id', profile!.id)
      .eq('is_active', true)
      .maybeSingle()
    if (tenantRow?.id) {
      await supabase.from('tenants').update({
        name: fullName || profile?.full_name,
        phone: phone || null,
        photo_url: avatarUrl,
      }).eq('id', tenantRow.id)
    }

    await refreshProfile()
    setPhotoFile(null)
    setProfileMsg('Profile updated successfully.')
    setProfileSaving(false)
  }

  async function changePassword() {
    setPasswordError(''); setPasswordMsg('')
    if (!currentPassword) { setPasswordError('Enter your current password.'); return }
    if (!newPassword) { setPasswordError('Enter a new password.'); return }
    if (newPassword.length < 6) { setPasswordError('New password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setPasswordError('New passwords do not match.'); return }
    if (newPassword === currentPassword) { setPasswordError('New password must differ from current.'); return }

    setPasswordSaving(true)

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

  function initials(name: string) {
    return (name || 'R').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  }

  const displayName = [firstName, lastName].filter(Boolean).join(' ') || profile?.full_name || ''
  const passwordStrength = newPassword.length >= 12 ? 4 : newPassword.length >= 8 ? 3 : newPassword.length >= 6 ? 2 : newPassword.length > 0 ? 1 : 0
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][passwordStrength]
  const strengthColor = ['', '#ef4444', '#f59e0b', '#0071E3', '#10b981'][passwordStrength]

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F]">Settings</h1>
        <p className="text-[15px] text-[#6E6E73] mt-0.5">Manage your account and profile</p>
      </div>

      {/* Profile */}
      <div style={GLASS} className="p-6">
        <SectionHeader>Profile</SectionHeader>

        {/* Avatar upload */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-shrink-0">
            <div className="w-18 h-18 w-[72px] h-[72px] rounded-full overflow-hidden flex items-center justify-center text-white text-xl font-bold"
              style={{ background: photoPreview ? undefined : 'rgba(0,113,227,0.85)', boxShadow: '0 4px 12px rgba(0,113,227,0.2)' }}>
              {photoPreview
                ? <img src={photoPreview} className="w-full h-full object-cover" alt="" />
                : <span>{initials(displayName)}</span>
              }
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-white transition-all"
              style={{ background: '#0071E3', boxShadow: '0 2px 8px rgba(0,113,227,0.35)' }}>
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
            <p className="text-[15px] font-semibold text-[#1D1D1F]">{displayName || 'Renter'}</p>
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-[13px] font-medium mt-1 transition-all"
              style={{ color: '#0071E3' }}>
              <Upload size={12} />
              {photoPreview ? 'Change photo' : 'Upload photo'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>First Name</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)}
                placeholder="Juan" className={INPUT_CLASS} style={INPUT_STYLE} />
            </div>
            <div>
              <label className={LABEL}>Last Name</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)}
                placeholder="Dela Cruz" className={INPUT_CLASS} style={INPUT_STYLE} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Contact Number</label>
            <div className="relative">
              <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AEAEB2] pointer-events-none" />
              <input value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="09XX XXX XXXX"
                className={INPUT_CLASS + ' pl-9'}
                style={INPUT_STYLE} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Email</label>
            <input value={profile?.email ?? ''} disabled
              className={INPUT_CLASS + ' opacity-50 cursor-not-allowed'} style={INPUT_STYLE} />
            <p className="text-[11px] text-[#AEAEB2] mt-1.5">Email cannot be changed here.</p>
          </div>

          <div>
            <label className={LABEL}>Address</label>
            <div className="relative">
              <MapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AEAEB2] pointer-events-none" />
              <input value={address} onChange={e => setAddress(e.target.value)}
                placeholder="Street, Barangay, City"
                className={INPUT_CLASS + ' pl-9'}
                style={INPUT_STYLE} />
            </div>
          </div>

          {profileError && (
            <div className="px-4 py-3 rounded-xl text-[13px] text-red-600 flex items-center gap-2"
              style={{ background: 'rgba(255,59,48,0.07)', border: '1px solid rgba(255,59,48,0.15)' }}>
              {profileError}
            </div>
          )}
          {profileMsg && (
            <div className="px-4 py-3 rounded-xl text-[13px] text-green-700 flex items-center gap-2"
              style={{ background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.18)' }}>
              <CheckCircle2 size={14} />
              {profileMsg}
            </div>
          )}

          <button onClick={saveProfile} disabled={profileSaving}
            className="h-11 px-6 rounded-xl text-white font-medium text-[14px] disabled:opacity-50 transition-all"
            style={{ background: '#0071E3', boxShadow: '0 4px 12px rgba(0,113,227,0.25)' }}>
            {profileSaving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div style={GLASS} className="p-6">
        <SectionHeader>Security</SectionHeader>
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(0,113,227,0.1)', border: '1px solid rgba(0,113,227,0.15)' }}>
            <Lock size={14} style={{ color: '#0071E3' }} />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-[#1D1D1F]">Change Password</p>
            <p className="text-[12px] text-[#6E6E73]">Verify your current password first</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className={LABEL}>Current Password</label>
            <PasswordInput value={currentPassword} onChange={setCurrentPassword} placeholder="Your current password" />
          </div>

          <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 12 }}>
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

          {newPassword.length > 0 && (
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex-1 h-1 rounded-full transition-all"
                  style={{ background: i <= passwordStrength ? strengthColor : 'rgba(0,0,0,0.08)' }} />
              ))}
              <span className="text-[11px] text-[#6E6E73] whitespace-nowrap">{strengthLabel}</span>
            </div>
          )}

          {passwordError && (
            <div className="px-4 py-3 rounded-xl text-[13px] text-red-600"
              style={{ background: 'rgba(255,59,48,0.07)', border: '1px solid rgba(255,59,48,0.15)' }}>
              {passwordError}
            </div>
          )}
          {passwordMsg && (
            <div className="px-4 py-3 rounded-xl text-[13px] text-green-700 flex items-center gap-2"
              style={{ background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.18)' }}>
              <CheckCircle2 size={14} /> {passwordMsg}
            </div>
          )}

          <button
            onClick={changePassword}
            disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
            className="h-11 px-6 rounded-xl text-white font-medium text-[14px] disabled:opacity-50 transition-all flex items-center gap-2"
            style={{ background: '#0071E3', boxShadow: '0 4px 12px rgba(0,113,227,0.25)' }}>
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
    </div>
  )
}
