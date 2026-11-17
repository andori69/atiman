import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface Props {
  children: React.ReactNode
  role?: 'landlord' | 'renter'
}

export default function ProtectedRoute({ children, role }: Props) {
  const { user, profile, loading } = useAuth()

  // Show skeleton while loading OR while user is authenticated but profile
  // hasn't arrived yet (brief window between auth event and profile fetch).
  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
        <div className="space-y-3 w-48">
          <div className="h-4 bg-[#E8E8ED] rounded-full animate-pulse" />
          <div className="h-4 bg-[#E8E8ED] rounded-full animate-pulse w-3/4" />
          <div className="h-4 bg-[#E8E8ED] rounded-full animate-pulse w-1/2" />
        </div>
      </div>
    )
  }

  if (!user || !profile) return <Navigate to="/login" replace />

  if (profile.role === 'renter' && (profile.status === 'pending' || profile.status === 'rejected')) {
    return <Navigate to="/pending" replace />
  }

  if (role && profile.role !== role) {
    return <Navigate to={profile.role === 'landlord' ? '/landlord' : '/renter'} replace />
  }

  return <>{children}</>
}
