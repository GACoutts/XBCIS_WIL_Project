import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login.jsx';
import SignUpPage from './SignUpPage.jsx';
import Ticket from './Ticket.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import RoleRoute from './components/RoleRoute.jsx';
import UserDashboard from './UserDashboard.jsx';
import StaffDashboard from './StaffDashboard.jsx';
import LandlordDashboard from './LandlordDashboard.jsx';
import LandlordTickets from './LandlordTickets.jsx';
import LandlordProperties from './LandlordProperties.jsx';
import Settings from './Settings.jsx';
import ContractorDashboard from './ContractorDashboard.jsx';
import Notifications from './Notifications.jsx';
import ForgotPassword from './ForgotPassword.jsx';
import ResetPassword from './ResetPassword.jsx';
import DebugHUD from './components/DebugHUD.jsx';
import ManageRoles from './components/ManageRoles.jsx';
import ReviewRoleRequest from './components/ReviewRoleRequest.jsx';
import RoleDashboardRedirect from './components/RoleDashboardRedirect.jsx';
import StaffTickets from './StaffTickets.jsx';
import StaffContractors from './StaffContractors.jsx';
import LandlordQuoteView from "./LandlordQuoteView.jsx";
import ContractorCompleted from './ContractorCompleted.jsx';

// Role management components
import RequestRole from './RequestRole.jsx';
import Sessions from './Sessions';

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

        <Route
          path="/sessions"
          element={
            <ProtectedRoute>
              <Sessions />
            </ProtectedRoute>
          }
        />

        {/* Home route - redirects to appropriate role-based dashboard */}
        <Route
          path="/"
          element={<RoleDashboardRedirect />}
        />

        {/* Client dashboard route */}
        <Route
          path="/client"
          element={
            <RoleRoute roles={['Client']}>
              <UserDashboard />
            </RoleRoute>
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

        {/* Landlord routes */}
        <Route
          path="/landlord"
          element={
            <RoleRoute roles={['Landlord']}>
              <LandlordDashboard />
            </RoleRoute>
          }
        />
        <Route
          path="/landlord/tickets"
          element={
            <RoleRoute roles={['Landlord']}>
              <LandlordTickets />
            </RoleRoute>
          }
        />
        <Route
          path="/landlord/properties"
          element={
            <RoleRoute roles={['Landlord']}>
              <LandlordProperties />
            </RoleRoute>
          }
        />
        <Route
          path="/landlord/settings"
          element={
            <RoleRoute roles={['Landlord']}>
              <Settings />
            </RoleRoute>
          }
        />

        {/* General settings page for clients, staff and contractors */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* Staff: Tickets */}
        <Route
          path="/tickets"
          element={
            <RoleRoute roles={['Staff']}>
              <StaffTickets />
            </RoleRoute>
          }
        />

        {/* Staff: Contractors */}
        <Route
          path="/contractors"
          element={
            <RoleRoute roles={['Staff']}>
              <StaffContractors />
            </RoleRoute>
          }
        />

        <Route
          path="/staff/settings"
          element={
            <RoleRoute roles={['Staff']}>
              <Settings />
            </RoleRoute>
          }
        />
        <Route
          path="/contractor/settings"
          element={
            <RoleRoute roles={['Contractor']}>
              <Settings />
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

        <Route path="/contractor/completed" element={<ContractorCompleted />} />

        {/* Notifications center - accessible to any logged-in user */}
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          }
        />

        {/* Backward compatibility redirects */}
        <Route path="/dashboard/staff" element={<Navigate to="/staff" replace />} />
        <Route path="/dashboard/landlord" element={<Navigate to="/landlord" replace />} />
        <Route path="/dashboard/client" element={<Navigate to="/client" replace />} />

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

        <Route path="/landlord/quotes" element={<LandlordQuoteView />} />

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
