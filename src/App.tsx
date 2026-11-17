import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import Placeholder from '@/components/Placeholder'

import Landing from '@/pages/auth/Landing'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import PendingApproval from '@/pages/auth/PendingApproval'

import LandlordLayout from '@/components/layouts/LandlordLayout'
import RenterLayout from '@/components/layouts/RenterLayout'

import Dashboard from '@/pages/landlord/Dashboard'
import Buildings from '@/pages/landlord/Buildings'
import Renters from '@/pages/landlord/Renters'
import Registrations from '@/pages/landlord/Registrations'
import Electricity from '@/pages/landlord/Electricity'
import Maintenance from '@/pages/landlord/Maintenance'
import Reports from '@/pages/landlord/Reports'
import Announcements from '@/pages/landlord/Announcements'
import LandlordSettings from '@/pages/landlord/Settings'
import LandlordVisitors from '@/pages/landlord/Visitors'
import LostFound from '@/pages/LostFound'

import RenterHome from '@/pages/renter/RenterHome'
import UploadPayment from '@/pages/renter/UploadPayment'
import RenterSettings from '@/pages/renter/Settings'
import RenterRequests from '@/pages/renter/Requests'
import RenterVisitors from '@/pages/renter/Visitors'
import AvailableRooms from '@/pages/renter/Rooms'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pending" element={<PendingApproval />} />

          {/* Landlord */}
          <Route
            path="/landlord"
            element={
              <ProtectedRoute role="landlord">
                <LandlordLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="registrations" element={<Registrations />} />
            <Route path="buildings" element={<Buildings />} />
            <Route path="electricity" element={<Electricity />} />
            <Route path="forecast" element={<Navigate to="/landlord/reports" replace />} />
            <Route path="maintenance" element={<Maintenance />} />
            <Route path="expenses" element={<Navigate to="/landlord/maintenance" replace />} />
            <Route path="renters" element={<Renters />} />
            <Route path="reports" element={<Reports />} />
            <Route path="announcements" element={<Announcements />} />
            <Route path="lost-found" element={<LostFound />} />
            <Route path="visitors" element={<LandlordVisitors />} />
            <Route path="settings" element={<LandlordSettings />} />
          </Route>

          {/* Renter */}
          <Route
            path="/renter"
            element={
              <ProtectedRoute role="renter">
                <RenterLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RenterHome />} />
            <Route path="payments" element={<Placeholder title="Payments" />} />
            <Route path="upload" element={<UploadPayment />} />
            <Route path="requests" element={<RenterRequests />} />
            <Route path="visitors" element={<RenterVisitors />} />
            <Route path="rooms" element={<AvailableRooms />} />
            <Route path="lost-found" element={<LostFound />} />
            <Route path="reviews" element={<Placeholder title="Reviews" />} />
            <Route path="settings" element={<RenterSettings />} />
            <Route path="more" element={<Placeholder title="More" />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
