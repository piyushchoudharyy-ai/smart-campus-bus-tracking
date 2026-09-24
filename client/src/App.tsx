import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.js';
import { Navbar } from './components/common/Navbar.js';
import { Login } from './pages/auth/Login.js';
import { Register } from './pages/auth/Register.js';
import { StudentDashboard } from './pages/student/StudentDashboard.js';
import { DriverDashboard } from './pages/driver/DriverDashboard.js';
import { AdminDashboard } from './pages/admin/AdminDashboard.js';
import { api } from './services/api.js';
import { useSocket } from './hooks/useSocket.js';
import type { CampusNotification, UserRole } from './types.js';

// Protected Route Component
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}> = ({ children, allowedRoles }) => {
  const { isAuthenticated, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Redirect to user's permitted dashboard
    if (role === 'admin') return <Navigate to="/admin" replace />;
    if (role === 'driver') return <Navigate to="/driver" replace />;
    return <Navigate to="/student" replace />;
  }

  return <>{children}</>;
};

// Main App Layout
const AppContent: React.FC = () => {
  const { isAuthenticated, role } = useAuth();
  const [notifications, setNotifications] = useState<CampusNotification[]>([]);

  // Load initial notifications
  const loadNotifications = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.get('/notifications');
      if (res.success && Array.isArray(res.data)) {
        setNotifications(res.data);
      }
    } catch {
      // Silently handle if not ready
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [isAuthenticated, role]);

  // Listen to live socket notifications
  useSocket({
    onNotification: (newNotif) => {
      setNotifications((prev) => [newNotif, ...prev]);
    }
  });

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar
        notifications={notifications}
        onMarkAllRead={handleMarkAllRead}
        onMarkRead={handleMarkRead}
      />

      <main className="flex-1">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Student Route */}
          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRoles={['student', 'admin', 'driver']}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />

          {/* Driver Route */}
          <Route
            path="/driver"
            element={
              <ProtectedRoute allowedRoles={['driver', 'admin']}>
                <DriverDashboard />
              </ProtectedRoute>
            }
          />

          {/* Admin Route */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Fallback Root Redirect */}
          <Route
            path="/"
            element={
              isAuthenticated ? (
                role === 'admin' ? (
                  <Navigate to="/admin" replace />
                ) : role === 'driver' ? (
                  <Navigate to="/driver" replace />
                ) : (
                  <Navigate to="/student" replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
};
export default App;
