import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'
import atimanLogo from '@/assets/atiman-logo.png'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Authentication failed. Please try again.')
      setLoading(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    const profile = profileData as Profile | null
    if (!profile) {
      // Sign the user back out so the session isn't stuck
      await supabase.auth.signOut()
      setError(
        profileError?.code === 'PGRST116'
          ? 'Account setup incomplete. Please register again or contact your landlord.'
          : 'Could not load your profile. Please try again.'
      )
      setLoading(false)
      return
    }

    if (profile.role === 'landlord') {
      navigate('/landlord')
    } else if (profile.status === 'pending' || profile.status === 'rejected') {
      navigate('/pending')
    } else {
      navigate('/renter')
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'radial-gradient(ellipse at 60% 0%, #dbeafe 0%, #f0f4ff 40%, #ffffff 70%)' }}>
      {/* Nav */}
      <nav className="flex items-center px-8 py-5">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-[#0071E3] text-[15px] font-medium hover:underline"
        >
          <ArrowLeft size={16} />
          <img src={atimanLogo} alt="ATIMAN" className="h-5 w-auto object-contain" />
          ATIMAN
        </button>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        {/* Logo mark */}
        <img src={atimanLogo} alt="ATIMAN" className="h-14 w-auto object-contain mb-6 drop-shadow-lg" />

        <h1 className="text-[28px] font-semibold tracking-tight text-[#1D1D1F] mb-1">Welcome back</h1>
        <p className="text-[15px] text-[#6E6E73] mb-8">Sign in to your ATIMAN account</p>

        {/* Card */}
        <div className="w-full max-w-sm bg-white rounded-2xl p-8" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }}>
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-100 rounded-xl text-[14px] text-red-600 flex items-start gap-2">
              <span className="mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full h-11 bg-[#F5F5F7] rounded-xl px-4 text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none focus:ring-2 focus:ring-[#0071E3] focus:bg-white transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium uppercase tracking-widest text-[#6E6E73] mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
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
              {resetSent ? (
                <p className="mt-2 text-[13px] text-green-600">Reset link sent — check your email.</p>
              ) : (
                <button
                  type="button"
                  disabled={resetLoading}
                  onClick={async () => {
                    if (!email) { setError('Enter your email above first.'); return }
                    setResetLoading(true)
                    await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: `${window.location.origin}/reset-password`,
                    })
                    setResetLoading(false)
                    setResetSent(true)
                  }}
                  className="mt-2 text-[13px] text-[#6E6E73] hover:text-[#0071E3] transition-colors disabled:opacity-50"
                >
                  {resetLoading ? 'Sending…' : 'Forgot password?'}
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#0071E3] text-white rounded-xl font-medium text-[15px] hover:bg-[#0077ED] active:scale-[0.98] disabled:opacity-50 transition-all duration-200 mt-1"
              style={{ boxShadow: loading ? 'none' : '0 4px 12px rgba(0,113,227,0.3)' }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-[15px] text-[#6E6E73] mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-[#0071E3] font-medium hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
