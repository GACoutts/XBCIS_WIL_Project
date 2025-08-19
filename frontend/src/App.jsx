import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './Login.jsx'
import SignUpPage from './SignUpPage.jsx'
import Ticket from './Ticket.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx';

export default function App() {
  return(
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Ticket />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
