import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AdminLayout from './components/layout/AdminLayout';
import Dashboard from './pages/Dashboard';
import MembersList from './pages/MembersList';
import AddMember from './pages/AddMember';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Packages from './pages/Packages';
import Attendance from './pages/Attendance';
import MemberDetail from './pages/MemberDetail';
import RevenueHistory from './pages/RevenueHistory';
import Equipment from './pages/Equipment';
import MemberKiosk from './pages/MemberKiosk';
import Store from './pages/Store';
import Inventory from './pages/Inventory';
import MemberShop from './pages/MemberShop';

const ProtectedRoute = ({ children }) => {
  const { user, profile, loading } = useAuth();
  
  if (loading) return null; // Wait for profile to load
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // If account is inactive, logout should have handled it, but to be safe:
  if (profile && !profile.is_active) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

const RoleProtectedRoute = ({ children, requireOwner = false }) => {
  const { profile, loading } = useAuth();
  
  if (loading) return null;

  if (requireOwner && profile?.role !== 'owner') {
    // Staff trying to access Owner-only pages
    return <Navigate to="/members" replace />;
  }
  
  // Dashboard is technically for everyone, but if they are staff, 
  // we might want to default them to members.
  // The user specifically said Staff see only Members and Attendance.
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="members" element={<MembersList />} />
            <Route path="members/new" element={<AddMember />} />
            <Route path="settings" element={<Settings />} />
            
            {/* Stubs for future pages */}
            <Route path="attendance" element={<Attendance />} />
            <Route path="equipment" element={<Equipment />} />
            <Route path="billing" element={<Packages />} />
            <Route path="revenue" element={<RevenueHistory />} />
            <Route path="members/:id" element={<MemberDetail />} />
            <Route path="shop" element={<MemberShop />} />
            <Route path="store" element={<Store />} />
            <Route path="inventory" element={<RoleProtectedRoute requireOwner={true}><Inventory /></RoleProtectedRoute>} />
          </Route>

          <Route path="/kiosk" element={<MemberKiosk />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
