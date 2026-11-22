import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { DashboardLayout } from './components/DashboardLayout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NormiProvider } from './context/NormiContext';
import { AccessLogsPage } from './pages/AccessLogsPage';
import { CollegesPage } from './pages/CollegesPage';
import { DevicesRoomsPage } from './pages/DevicesRoomsPage';
import { KioskPage } from './pages/KioskPage';
import { LabMonitoringPage } from './pages/LabMonitoringPage';
import { LoginPage } from './pages/LoginPage';
import { SchedulesPage } from './pages/SchedulesPage';
import { StudentsPage } from './pages/StudentsPage';
import { UsersPage } from './pages/UsersPage';

const ROUTE_PAGE_NAMES: Record<string, string> = {
  '/login': 'Sign In',
  '/kiosk': 'Live RFID Kiosk',
  '/dashboard/monitoring': 'Lab Monitoring',
  '/dashboard/schedules': 'Subject Schedule & Attendance',
  '/dashboard/colleges': 'Colleges',
  '/dashboard/students': 'Students & RFID',
  '/dashboard/logs': 'Access Logs & Reports',
  '/dashboard/devices': 'Devices & Rooms',
  '/dashboard/users': 'User Management',
  '/users': 'User Management',
};

function RouteTitleManager() {
  const location = useLocation();
  useEffect(() => {
    const pageName = ROUTE_PAGE_NAMES[location.pathname] ?? 'Dashboard';
    document.title = `NORMI Attendance System | ${pageName}`;
  }, [location.pathname]);
  return null;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F7F3]">
        <p className="text-xs font-medium text-[#64748B]">Loading NORMI Attendance System...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <>{children}</>;
}

function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F7F3]">
        <p className="text-xs font-medium text-[#64748B]">Verifying access permissions...</p>
      </div>
    );
  }

  if (session?.role !== 'super_admin') {
    return <Navigate to="/dashboard/monitoring" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <NormiProvider>
        <BrowserRouter>
          <RouteTitleManager />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/kiosk"
              element={
                <RequireAuth>
                  <KioskPage />
                </RequireAuth>
              }
            />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <DashboardLayout />
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="/dashboard/monitoring" replace />} />
              <Route path="monitoring" element={<LabMonitoringPage />} />
              <Route path="schedules" element={<SchedulesPage />} />
              <Route path="colleges" element={<CollegesPage />} />
              <Route path="students" element={<StudentsPage />} />
              <Route path="logs" element={<AccessLogsPage />} />
              <Route path="devices" element={<DevicesRoomsPage />} />
              <Route
                path="users"
                element={
                  <RequireSuperAdmin>
                    <UsersPage />
                  </RequireSuperAdmin>
                }
              />
            </Route>
            <Route
              path="/users"
              element={
                <RequireAuth>
                  <RequireSuperAdmin>
                    <Navigate to="/dashboard/users" replace />
                  </RequireSuperAdmin>
                </RequireAuth>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard/monitoring" replace />} />
            <Route path="*" element={<Navigate to="/dashboard/monitoring" replace />} />
          </Routes>
        </BrowserRouter>

        <Toaster
          position="bottom-right"
          toastOptions={{
            className: '!border !border-[#E2E8F0] !bg-white !text-[#0F172A] !rounded-xl',
            descriptionClassName: '!text-[#64748B] !text-xs',
          }}
        />
      </NormiProvider>
    </AuthProvider>
  );
}
