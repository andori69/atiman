// @ts-nocheck
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Building2, User, Eye, EyeOff, ArrowLeft, CheckCircle2, GraduationCap, Briefcase } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { generateLandlordCode } from '@/lib/utils'
import type { Profile } from '@/types/database'
import atimanLogo from '@/assets/atiman-logo.png'

type Role = 'landlord' | 'renter'

export default function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState<1 | 2>(1)
  const [role, setRole] = useState<Role | null>(null)
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    landlordCode: searchParams.get('code') ?? '',
    // landlord boarding house address
    boardingHouseName: '',
    street: '',
    barangay: '',
    city: '',
    province: '',
    // renter home address (separate fields)
    homeStreet: '',
    homeBarangay: '',
    homeCity: '',
    homeProvince: '',
    // renter occupation
    occupationType: '' as 'student' | 'working' | '',
    school: '',
    program: '',
    yearLevel: '',
    age: '',
    workplace: '',
    parentName: '',
    parentPhone: '',
  })

  function updateForm(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError('')

    let linkedLandlordId: string | null = null

    if (role === 'renter') {
      // Normalize: strip all whitespace variants and force uppercase
      const normalizedCode = form.landlordCode
        .replace(/\s+/g, '')   // remove any spaces/tabs/newlines
        .toUpperCase()

      // Fast format check before hitting the database
      if (!/^ATIMAN-[A-Z0-9]{4}$/.test(normalizedCode)) {
        setError('Landlord codes look like ATIMAN-XXXX. Please check and try again.')
        setLoading(false)
        return
      }

      // Direct table query — works because the RLS policy
      // "profiles_landlord_code_lookup" allows SELECT on landlord rows.
      // We only request `id` so no personal data is returned.
      const { data: landlordRow, error: lookupError } = await supabase
        .from('profiles')
        .select('id')
        .eq('landlord_code', normalizedCode)
        .eq('role', 'landlord')
        .maybeSingle()

      if (lookupError) {
        setError('Could not verify the landlord code. Please check your connection and try again.')
        setLoading(false)
        return
      }

      if (!landlordRow) {
        setError('Invalid landlord code. Please check with your landlord.')
        setLoading(false)
        return
      }

      linkedLandlordId = landlordRow.id
    }

    const homeAddressJoined = [form.homeStreet, form.homeBarangay, form.homeCity, form.homeProvince]
      .map(s => s.trim()).filter(Boolean).join(', ')

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          role: role!,
          full_name: form.fullName,
          phone: form.phone,
          status: role === 'landlord' ? 'approved' : 'pending',
          landlord_code: role === 'landlord' ? generateLandlordCode() : null,
          linked_landlord_id: linkedLandlordId,
          ...(role === 'renter' && {
            home_address: homeAddressJoined,
            home_street: form.homeStreet.trim() || null,
            home_barangay: form.homeBarangay.trim() || null,
            home_city: form.homeCity.trim() || null,
            home_province: form.homeProvince.trim() || null,
            occupation_type: form.occupationType || null,
            school: form.occupationType === 'student' ? form.school.trim() : null,
            program: form.occupationType === 'student' ? form.program.trim() : null,
            year_level: form.occupationType === 'student' ? form.yearLevel : null,
            age: form.occupationType === 'working' ? form.age.trim() : null,
            workplace: form.occupationType === 'working' ? form.workplace.trim() : null,
            parent_name: form.parentName.trim(),
            parent_phone: form.parentPhone.trim(),
          }),
        },
      },
    })

    if (authError || !authData.user) {
      setError(authError?.message ?? 'Registration failed')
      setLoading(false)
      return
    }

    if (role === 'landlord') {
      if (form.boardingHouseName.trim()) {
        await supabase.from('buildings').insert({
          landlord_id: authData.user.id,
          name: form.boardingHouseName.trim(),
          street: form.street.trim() || null,
          barangay: form.barangay.trim() || null,
          city: form.city.trim() || null,
          province: form.province.trim() || null,
        })
      }
      navigate('/landlord')
    } else {
      // Explicitly persist new address columns in case the DB trigger
      // was created before these columns were added to profiles.
      await supabase.from('profiles').update({
        home_address: homeAddressJoined || null,
        home_street: form.homeStreet.trim() || null,
        home_barangay: form.homeBarangay.trim() || null,
        home_city: form.homeCity.trim() || null,
        home_province: form.homeProvince.trim() || null,
        occupation_type: form.occupationType || null,
        school: form.occupationType === 'student' ? form.school.trim() : null,
        program: form.occupationType === 'student' ? form.program.trim() : null,
        year_level: form.occupationType === 'student' ? form.yearLevel : null,
        age: form.occupationType === 'working' ? form.age.trim() : null,
        workplace: form.occupationType === 'working' ? form.workplace.trim() : null,
        parent_name: form.parentName.trim() || null,
        parent_phone: form.parentPhone.trim() || null,
      }).eq('id', authData.user.id)
      navigate('/pending')
    }
  }

  /* ── Step 1: Role selection ── */
  if (step === 1) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'radial-gradient(ellipse at 60% 0%, #dbeafe 0%, #f0f4ff 40%, #ffffff 70%)' }}>
        <nav className="flex items-center px-8 py-5">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-[#0071E3] text-[15px] font-medium hover:underline">
            <ArrowLeft size={16} />
            <img src={atimanLogo} alt="ATIMAN" className="h-5 w-auto object-contain" />
            ATIMAN
          </button>
        </nav>

        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
          <img src={atimanLogo} alt="ATIMAN" className="h-16 w-auto object-contain mb-6 drop-shadow-lg" />

          <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F] mb-1">Create your account</h1>
          <p className="text-[15px] text-[#6E6E73] mb-10">Choose how you'll use ATIMAN</p>

          <div className="w-full max-w-sm space-y-3 mb-6">
            {[
              { r: 'landlord' as Role, Icon: Building2, title: "I'm a Landlord", desc: 'Manage boarding houses, rooms, and tenants', color: 'text-[#0071E3]', bg: 'bg-blue-50' },
              { r: 'renter' as Role, Icon: User, title: "I'm a Renter", desc: 'View rent, upload payments, and request maintenance', color: 'text-[#34C759]', bg: 'bg-green-50' },
            ].map(({ r, Icon, title, desc, color, bg }) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`w-full p-5 rounded-2xl border-2 text-left transition-all duration-200 flex items-start gap-4 ${
                  role === r ? 'border-[#0071E3] bg-blue-50' : 'border-[#E8E8ED] bg-white hover:border-[#D2D2D7]'
                }`}
                style={{ boxShadow: role === r ? '0 4px 16px rgba(0,113,227,0.12)' : '0 1px 4px rgba(0,0,0,0.04)' }}
              >
                <div className={`w-10 h-10 rounded-xl ${role === r ? 'bg-[#0071E3]' : bg} flex items-center justify-center shrink-0 transition-colors`}>
                  <Icon size={20} className={role === r ? 'text-white' : color} />
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-semibold text-[#1D1D1F] mb-0.5">{title}</p>
                  <p className="text-[13px] text-[#6E6E73] leading-snug">{desc}</p>
                </div>
                {role === r && <CheckCircle2 size={20} className="text-[#0071E3] shrink-0 mt-0.5" />}
              </button>
            ))}
          </div>

          {role && (
            <button
              onClick={() => setStep(2)}
              className="w-full max-w-sm h-12 bg-[#0071E3] text-white rounded-xl font-medium text-[15px] hover:bg-[#0077ED] active:scale-[0.98] transition-all duration-200"
              style={{ boxShadow: '0 4px 12px rgba(0,113,227,0.3)' }}
            >
              Continue
            </button>
          )}

          <p className="text-center text-[15px] text-[#6E6E73] mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-[#0071E3] font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    )
  }

  /* ── Step 2: Registration form ── */
  const landlordFields = [
    { label: 'Full Name', field: 'fullName' as const, type: 'text', placeholder: 'Juan dela Cruz' },
    { label: 'Email', field: 'email' as const, type: 'email', placeholder: 'you@example.com' },
    { label: 'Phone', field: 'phone' as const, type: 'tel', placeholder: '+63 912 345 6789' },
  ]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'radial-gradient(ellipse at 60% 0%, #dbeafe 0%, #f0f4ff 40%, #ffffff 70%)' }}>
      <nav className="flex items-center px-8 py-5">
        <button onClick={() => setStep(1)} className="flex items-center gap-2 text-[#0071E3] text-[15px] font-medium hover:underline">
          <ArrowLeft size={16} /> Back
        </button>
      </nav>

      <div className="flex-1 flex flex-col items-center px-6 pt-4 pb-16">
        <img src={atimanLogo} alt="ATIMAN" className="h-14 w-auto object-contain mb-6 drop-shadow-lg" />

        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F] mb-1">
          {role === 'landlord' ? 'Landlord' : 'Renter'} Registration
        </h1>
        <p className="text-[15px] text-[#6E6E73] mb-8">Fill in your details to get started</p>

        <div className="w-full max-w-xl bg-white rounded-2xl p-8 space-y-5" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }}>
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl text-[14px] text-red-600 flex items-start gap-2">
              <span className="mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Common fields */}
            {landlordFields.map(({ label, field, type, placeholder }) => (
              <div key={field}>
                <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">{label}</label>
                <input
                  type={type}
                  value={form[field]}
                  onChange={(e) => updateForm(field, e.target.value)}
                  placeholder={placeholder}
                  required
                  className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all duration-200"
                />
              </div>
            ))}

            {/* Landlord-only: boarding house info */}
            {role === 'landlord' && (
              <>
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex-1 h-px bg-[#E8E8ED]" />
                  <span className="text-[12px] font-medium uppercase tracking-widest text-[#AEAEB2]">Boarding House</span>
                  <div className="flex-1 h-px bg-[#E8E8ED]" />
                </div>

                <div>
                  <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Boarding House Name</label>
                  <input
                    type="text"
                    value={form.boardingHouseName}
                    onChange={(e) => updateForm('boardingHouseName', e.target.value)}
                    placeholder="e.g. Santos Boarding House"
                    required
                    className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Street</label>
                  <input
                    type="text"
                    value={form.street}
                    onChange={(e) => updateForm('street', e.target.value)}
                    placeholder="e.g. 123 Rizal St."
                    required
                    className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Barangay</label>
                  <input
                    type="text"
                    value={form.barangay}
                    onChange={(e) => updateForm('barangay', e.target.value)}
                    placeholder="e.g. Barangay 1"
                    required
                    className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">City / Municipality</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => updateForm('city', e.target.value)}
                    placeholder="e.g. Iligan City"
                    required
                    className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Province</label>
                  <input
                    type="text"
                    value={form.province}
                    onChange={(e) => updateForm('province', e.target.value)}
                    placeholder="e.g. Lanao del Norte"
                    required
                    className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all duration-200"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-[#E8E8ED]" />
                  <span className="text-[12px] font-medium uppercase tracking-widest text-[#AEAEB2]">Security</span>
                  <div className="flex-1 h-px bg-[#E8E8ED]" />
                </div>
              </>
            )}

            {/* Renter-only fields */}
            {role === 'renter' && (
              <>
                <div>
                  <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Landlord Code</label>
                  <input
                    type="text"
                    value={form.landlordCode}
                    onChange={(e) =>
                      updateForm('landlordCode', e.target.value.replace(/\s+/g, '').toUpperCase())
                    }
                    placeholder="ATIMAN-XXXX"
                    maxLength={11}
                    required
                    className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all duration-200 font-mono tracking-wider"
                  />
                  <p className="text-[12px] text-[#AEAEB2] mt-1.5">Ask your landlord for this code</p>
                </div>

                {/* Home Address — stacked fields */}
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex-1 h-px bg-[#E8E8ED]" />
                  <span className="text-[12px] font-medium uppercase tracking-widest text-[#AEAEB2]">Home Address</span>
                  <div className="flex-1 h-px bg-[#E8E8ED]" />
                </div>

                <div>
                  <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Street</label>
                  <input
                    type="text"
                    value={form.homeStreet}
                    onChange={(e) => updateForm('homeStreet', e.target.value)}
                    placeholder="e.g. 123 Rizal St."
                    required
                    className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Barangay</label>
                  <input
                    type="text"
                    value={form.homeBarangay}
                    onChange={(e) => updateForm('homeBarangay', e.target.value)}
                    placeholder="e.g. Barangay 1"
                    required
                    className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">City / Municipality</label>
                  <input
                    type="text"
                    value={form.homeCity}
                    onChange={(e) => updateForm('homeCity', e.target.value)}
                    placeholder="e.g. Iligan City"
                    required
                    className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Province</label>
                  <input
                    type="text"
                    value={form.homeProvince}
                    onChange={(e) => updateForm('homeProvince', e.target.value)}
                    placeholder="e.g. Lanao del Norte"
                    required
                    className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all duration-200"
                  />
                </div>

                {/* Occupation type selection */}
                <div>
                  <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Occupation Status</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { type: 'student' as const, Icon: GraduationCap, label: 'Student', desc: 'Currently enrolled', color: 'text-[#0071E3]', bg: 'bg-blue-50' },
                      { type: 'working' as const, Icon: Briefcase, label: 'Working', desc: 'Currently employed', color: 'text-[#34C759]', bg: 'bg-green-50' },
                    ].map(({ type, Icon, label, desc, color, bg }) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => updateForm('occupationType', type)}
                        className={`p-3.5 rounded-xl border-2 text-left transition-all duration-200 flex flex-col gap-1.5 ${
                          form.occupationType === type
                            ? 'border-[#0071E3] bg-blue-50'
                            : 'border-[#E8E8ED] bg-[#F5F5F7] hover:border-[#D2D2D7]'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg ${form.occupationType === type ? 'bg-[#0071E3]' : bg} flex items-center justify-center transition-colors`}>
                          <Icon size={16} className={form.occupationType === type ? 'text-white' : color} />
                        </div>
                        <p className="text-[13px] font-semibold text-[#1D1D1F]">{label}</p>
                        <p className="text-[11px] text-[#AEAEB2] leading-tight">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Student fields — stacked */}
                {form.occupationType === 'student' && (
                  <>
                    <div>
                      <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">School</label>
                      <input
                        type="text"
                        value={form.school}
                        onChange={(e) => updateForm('school', e.target.value)}
                        placeholder="e.g. MSU-IIT"
                        required
                        className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all duration-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Program / Course</label>
                      <input
                        type="text"
                        value={form.program}
                        onChange={(e) => updateForm('program', e.target.value)}
                        placeholder="e.g. BSCS"
                        required
                        className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all duration-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Year Level</label>
                      <select
                        value={form.yearLevel}
                        onChange={(e) => updateForm('yearLevel', e.target.value)}
                        required
                        className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all duration-200"
                      >
                        <option value="">Select year</option>
                        {['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', 'Graduate', 'Masteral', 'Doctorate / PhD'].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* Working fields — stacked */}
                {form.occupationType === 'working' && (
                  <>
                    <div>
                      <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Age</label>
                      <input
                        type="number"
                        value={form.age}
                        onChange={(e) => updateForm('age', e.target.value)}
                        placeholder="e.g. 25"
                        min="18"
                        max="99"
                        required
                        className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all duration-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Company</label>
                      <input
                        type="text"
                        value={form.workplace}
                        onChange={(e) => updateForm('workplace', e.target.value)}
                        placeholder="e.g. BPO Corp."
                        required
                        className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all duration-200"
                      />
                    </div>
                  </>
                )}

                {/* Emergency contact divider */}
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex-1 h-px bg-[#E8E8ED]" />
                  <span className="text-[12px] font-medium uppercase tracking-widest text-[#AEAEB2]">Emergency Contact</span>
                  <div className="flex-1 h-px bg-[#E8E8ED]" />
                </div>

                <div>
                  <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Contact Name</label>
                  <input
                    type="text"
                    value={form.parentName}
                    onChange={(e) => updateForm('parentName', e.target.value)}
                    placeholder="Parent, guardian, or relative"
                    required
                    className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Contact Number</label>
                  <input
                    type="tel"
                    value={form.parentPhone}
                    onChange={(e) => updateForm('parentPhone', e.target.value)}
                    placeholder="+63 912 345 6789"
                    required
                    className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all duration-200"
                  />
                </div>

                {/* Password divider */}
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex-1 h-px bg-[#E8E8ED]" />
                  <span className="text-[12px] font-medium uppercase tracking-widest text-[#AEAEB2]">Security</span>
                  <div className="flex-1 h-px bg-[#E8E8ED]" />
                </div>
              </>
            )}

            {/* Password */}
            <div>
              <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => updateForm('password', e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  minLength={6}
                  className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 pr-12 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#AEAEB2] hover:text-[#6E6E73] transition-colors"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">Confirm Password</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => updateForm('confirmPassword', e.target.value)}
                placeholder="Re-enter password"
                required
                className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all duration-200"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#0071E3] text-white rounded-xl font-medium text-[15px] hover:bg-[#0077ED] active:scale-[0.98] disabled:opacity-50 transition-all duration-200 mt-2"
              style={{ boxShadow: loading ? 'none' : '0 4px 12px rgba(0,113,227,0.3)' }}
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-[15px] text-[#6E6E73] mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-[#0071E3] font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
