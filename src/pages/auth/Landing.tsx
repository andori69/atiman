import { useNavigate } from 'react-router-dom'
import atimanLogo from '@/assets/atiman-logo.png'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'radial-gradient(ellipse at 60% 0%, #dbeafe 0%, #f0f4ff 40%, #ffffff 70%)' }}>
      {/* Top nav bar */}
      <nav className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2">
          <img src={atimanLogo} alt="ATIMAN" className="h-7 w-auto object-contain" />
          <span className="text-[17px] font-semibold tracking-tight text-[#1D1D1F]">ATIMAN</span>
        </div>
        <button
          onClick={() => navigate('/login')}
          className="text-[15px] font-medium text-[#0071E3] hover:underline transition-all"
        >
          Log In
        </button>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center pb-16">
        {/* Logo mark */}
        <div className="mb-8">
          <img src={atimanLogo} alt="ATIMAN" className="h-24 w-auto object-contain drop-shadow-xl" />
        </div>

        <h1 className="text-[42px] sm:text-[52px] font-semibold tracking-tight text-[#1D1D1F] mb-4 leading-tight">
          ATIMAN
        </h1>

        <p className="text-[19px] text-[#6E6E73] mb-3 max-w-sm leading-relaxed">
          Take care of your boarding house, digitally.
        </p>

        <p className="text-[15px] text-[#AEAEB2] mb-12 max-w-xs">
          Manage rooms, payments, and tenants — all in one place.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-sm">
          <button
            onClick={() => navigate('/register')}
            className="flex-1 h-12 bg-[#0071E3] text-white rounded-xl font-medium text-[15px] hover:bg-[#0077ED] active:scale-95 transition-all duration-200 shadow-md"
            style={{ boxShadow: '0 4px 16px rgba(0,113,227,0.3)' }}
          >
            Get Started
          </button>
          <button
            onClick={() => navigate('/login')}
            className="flex-1 h-12 bg-white text-[#1D1D1F] rounded-xl font-medium text-[15px] hover:bg-[#F5F5F7] active:scale-95 transition-all duration-200 border border-[#E8E8ED]"
          >
            Log In
          </button>
        </div>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-2 px-6 pb-10">
        {['Rent Tracking', 'Payment Uploads', 'Electricity Splits', 'QR Check-in', 'Maintenance Requests'].map(f => (
          <span key={f} className="px-4 py-1.5 bg-white border border-[#E8E8ED] rounded-full text-[13px] text-[#6E6E73] font-medium shadow-sm">
            {f}
          </span>
        ))}
      </div>

      <p className="text-center text-[13px] text-[#AEAEB2] pb-6">
        Made for Filipino landlords and tenants
      </p>
    </div>
  )
}
