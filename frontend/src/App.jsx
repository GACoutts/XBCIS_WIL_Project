import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './Login.jsx'
import SignUpPage from './SignUpPage.jsx'
import Ticket from './Ticket.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx';
import UserDashboard from './UserDashboard.jsx';
import ForgotPassword from './ForgotPassword.jsx';
import ResetPassword from './ResetPassword.jsx';
import RoleRoute from './components/RoleRoute.jsx';
import StaffDashboard from './StaffDashboard.jsx';
import LandlordDashboard from './LandlordDashboard.jsx';
import DebugHUD from './components/DebugHUD.jsx';

// Optional (to be used later when hooked up)
// import ContractorDashboard from './ContractorDashboard.jsx';
import RequestRole from './RequestRole.jsx';

export default function App() {
  return (
    <>
      {/* Debug overlay always visible in bottom-right */}
      <DebugHUD />
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Authenticated general area (any logged-in role) */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <UserDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ticket"
        element={
          <ProtectedRoute>
            <Ticket />
          </ProtectedRoute>
        }
      />

      {/* Role-gated areas */}
      <Route
        path="/staff"
        element={
          <RoleRoute roles={['Staff']}>
            <StaffDashboard />
          </RoleRoute>
        }
      />

      <Route
        path="/landlord"
        element={
          <RoleRoute roles={['Landlord']}>
            <LandlordDashboard />
          </RoleRoute>
        }
      />

      {/* Optional routes 
      <Route
        path="/contractor"
        element={
          <RoleRoute roles={['Contractor', 'Staff']}>
            <ContractorDashboard />
          </RoleRoute>
        }
      />
      */}

      <Route path="/request-role" element={<ProtectedRoute><RequestRole /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
