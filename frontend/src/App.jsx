import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login.jsx';
import SignUpPage from './SignUpPage.jsx';
import Ticket from './Ticket.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import RoleRoute from './components/RoleRoute.jsx';
import UserDashboard from './UserDashboard.jsx';
import StaffDashboard from './StaffDashboard.jsx';
import LandlordDashboard from './LandlordDashboard.jsx';
import ContractorDashboard from './ContractorDashboard.jsx';
import ForgotPassword from './ForgotPassword.jsx';
import ResetPassword from './ResetPassword.jsx';
import DebugHUD from './components/DebugHUD.jsx';

// Role management components
import RequestRole from './RequestRole.jsx';
import ManageRoles from './components/ManageRoles.jsx';
import ReviewRoleRequest from './components/ReviewRoleRequest.jsx';

export default function App() {
  // Only show DebugHUD in development mode
  const isDevelopment = import.meta.env.DEV || import.meta.env.VITE_DEBUG_HUD === 'true';
  
  return (
    <>
      {/* Debug overlay - only in development */}
      {isDevelopment && <DebugHUD />}
      <Routes>
        {/* Public routes */}
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
        
        {/* Client-only ticket creation */}
        <Route
          path="/ticket"
          element={
            <RoleRoute roles={['Client']}>
              <Ticket />
            </RoleRoute>
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

        <Route
          path="/contractor"
          element={
            <RoleRoute roles={['Contractor']}>
              <ContractorDashboard />
            </RoleRoute>
          }
        />

        {/* Backward compatibility redirects */}
        <Route path="/dashboard/staff" element={<Navigate to="/staff" replace />} />
        <Route path="/dashboard/landlord" element={<Navigate to="/landlord" replace />} />
        <Route path="/dashboard/client" element={<Navigate to="/" replace />} />

        {/* Role management */}
        <Route path="/request-role" element={<ProtectedRoute><RequestRole /></ProtectedRoute>} />
        
        {/* Staff role management routes */}
        <Route
          path="/staff/manage-roles"
          element={
            <RoleRoute roles={['Staff']}>
              <ManageRoles />
            </RoleRoute>
          }
        />
        
        <Route
          path="/staff/role-requests"
          element={
            <RoleRoute roles={['Staff']}>
              <ReviewRoleRequest />
            </RoleRoute>
          }
        />

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
