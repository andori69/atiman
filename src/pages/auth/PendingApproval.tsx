import { Clock, CheckCircle, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import atimanLogo from '@/assets/atiman-logo.png'

export default function PendingApproval() {
  const { signOut, profile } = useAuth()
  const navigate = useNavigate()
  const isRejected = profile?.status === 'rejected'

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'radial-gradient(ellipse at 60% 0%, #dbeafe 0%, #f0f4ff 40%, #ffffff 70%)' }}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <img src={atimanLogo} alt="ATIMAN" className="h-9 w-auto object-contain" />
        <span className="text-[24px] font-bold tracking-tight text-[#1e1b4b]">ATIMAN</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl p-8 text-center" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' }}>
        {/* Status icon */}
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${isRejected ? 'bg-red-50' : 'bg-amber-50'}`}>
          {isRejected
            ? <XCircle size={36} className="text-[#FF3B30]" />
            : <Clock size={36} className="text-[#FF9500]" />
          }
        </div>

        <h1 className="text-[22px] font-semibold text-[#1D1D1F] mb-2">
          {isRejected ? 'Account Not Approved' : 'Waiting for Approval'}
        </h1>

        <p className="text-[15px] text-[#6E6E73] leading-relaxed mb-6">
          {isRejected
            ? profile?.rejection_reason ?? 'Your account was not approved. Please contact your landlord.'
            : "Your registration has been submitted. Your landlord will review and approve your account."}
        </p>

        {!isRejected && (
          <div className="bg-[#F5F5F7] rounded-xl p-4 mb-6 text-left space-y-2.5">
            {[
              { icon: CheckCircle, text: 'Registration submitted', done: true },
              { icon: Clock, text: 'Waiting for landlord approval', done: false },
              { icon: Clock, text: 'Access granted', done: false },
            ].map(({ icon: Icon, text, done }, i) => (
              <div key={i} className="flex items-center gap-3">
                <Icon size={16} className={done ? 'text-[#34C759]' : 'text-[#AEAEB2]'} />
                <span className={`text-[14px] ${done ? 'text-[#1D1D1F] font-medium' : 'text-[#AEAEB2]'}`}>{text}</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleSignOut}
          className="w-full h-11 bg-[#F5F5F7] text-[#1D1D1F] rounded-xl font-medium text-[15px] hover:bg-[#E8E8ED] active:scale-[0.98] transition-all duration-200"
        >
          Log Out
        </button>
      </div>

    </div>
  )
}
