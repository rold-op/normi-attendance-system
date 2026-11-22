import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  CreditCard,
  LogOut,
  Menu,
  Search,
  Trash2,
  UploadCloud,
  User,
  WifiOff,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNormi } from '../context/NormiContext';
import { formatRoleLabel } from '../types/normi';
import { Sidebar } from './Sidebar';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

export interface DashboardOutletContext {
  globalSearch: string;
  setGlobalSearch: (value: string) => void;
}

export function useDashboardSearch() {
  return useOutletContext<DashboardOutletContext>();
}

const ROUTE_PLACEHOLDERS: Record<string, string> = {
  '/dashboard/monitoring': 'Search rooms, colleges, active classes, or RFID taps...',
  '/dashboard/schedules': 'Search subject code, name, instructor, or room...',
  '/dashboard/colleges': 'Search college code, department name, or dean...',
  '/dashboard/students': 'Search student name, student ID, program, or RFID UID...',
  '/dashboard/logs': 'Search access logs by student, RFID UID, room, or subject...',
  '/dashboard/devices': 'Search rooms, floors, ESP32 device UIDs, or colleges...',
  '/dashboard/users': 'Search users by full name or email...',
};

function formatInspirationClock(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day} ${month}, ${year} ${hours}:${minutes}`;
}

export function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  const {
    devices,
    accessLogs,
    roomById,
    simulateLiveTap,
    syncDeviceOfflineBatch,
    isCapturingRfid,
    purgeOperationalData,
  } = useNormi();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Reset global search when navigating between modules
  useEffect(() => {
    setGlobalSearch('');
  }, [location.pathname]);

  const offlineDevices = useMemo(
    () => devices.filter((d) => d.status === 'offline'),
    [devices]
  );

  const deniedLogs = useMemo(
    () => accessLogs.filter((l) => l.attendanceStatus === 'denied').slice(0, 6),
    [accessLogs]
  );

  const alertCount = offlineDevices.length + deniedLogs.length;

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const searchPlaceholder =
    ROUTE_PLACEHOLDERS[location.pathname] ?? 'Search NORMI attendance records...';

  return (
    <div className="min-h-screen flex bg-[#F4F6F4] text-[#0F172A] antialiased">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Floating Search + Date/Time + Forest Green Action Buttons */}
        <header className="w-full max-w-[1440px] mx-auto px-4 sm:px-7 pt-5 pb-2 flex items-center justify-between gap-4 shrink-0 no-print">
          <div className="flex items-center gap-3 flex-1 min-w-0 max-w-3xl">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#1E5628]/35 bg-white text-[#1E5628] hover:bg-[#EAF2EC]/50 shrink-0"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="relative flex-1 min-w-0">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1E5628]"
                aria-hidden="true"
              />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label="Search current module"
                className="h-10 w-full rounded-xl border border-black/[0.08] bg-white pl-10 pr-9 text-xs sm:text-sm text-[#0F172A] placeholder:text-[#94A3B8] shadow-sm focus:border-[#1E5628] focus:ring-2 focus:ring-[#1E5628]/15 focus:outline-none transition-all tracking-tight"
              />
              {globalSearch && (
                <button
                  type="button"
                  onClick={() => setGlobalSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-md text-[#64748B] hover:text-[#0F172A]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <time
              dateTime={now.toISOString()}
              className="hidden md:inline-block font-mono text-xs font-medium text-[#475569] tabular-nums whitespace-nowrap"
            >
              {formatInspirationClock(now)}
            </time>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setNotificationsOpen(true)}
                title="Notifications & hardware alerts"
                aria-label="Notifications and hardware alerts"
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#1E5628] text-white hover:bg-[#16421E] transition-colors shadow-[0_4px_12px_rgba(30,86,40,0.2)]"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                {alertCount > 0 && (
                  <span className="sr-only">{alertCount} active alerts</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                title={`Account (${session?.name ?? 'User'})`}
                aria-label="Account profile and sign out"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#1E5628] text-white hover:bg-[#16421E] transition-colors shadow-[0_4px_12px_rgba(30,86,40,0.2)]"
              >
                <User className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-7 py-4 pb-8">
          <Outlet context={{ globalSearch, setGlobalSearch }} />
        </main>
      </div>

      {/* Notifications & Hardware Alerts Modal */}
      <Modal
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        title="Campus Notifications & Hardware Alerts"
        description="Offline ESP32 terminals, buffered offline scans, and recent unauthorized RFID attempts."
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-5">
          {/* Quick Hardware Tap Trigger */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#1E5628]/25 bg-[#F2F7F3] px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-[#0F172A]">Live RFID Scanner Simulator</p>
              <p className="text-[11px] text-[#64748B]">
                Dispatch a simulated ESP32 tap across campus rooms
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => simulateLiveTap({ mode: 'random' })}
            >
              <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isCapturingRfid ? 'Send Test RFID' : 'Simulate Tap'}</span>
            </Button>
          </div>

          {/* Offline Devices */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[#0F172A]">
              Offline Scanner Nodes ({offlineDevices.length})
            </h3>
            {offlineDevices.length === 0 ? (
              <p className="text-xs text-[#64748B] py-2">
                All registered ESP32 scanners are online and reporting heartbeats.
              </p>
            ) : (
              <div className="divide-y divide-[#E2E8F0] rounded-xl border border-[#E2E8F0]">
                {offlineDevices.map((dev) => {
                  const rm = roomById.get(dev.roomId);
                  return (
                    <div
                      key={dev.id}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <WifiOff className="h-4 w-4 text-[#DC2626] shrink-0" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#0F172A] truncate">
                            {dev.deviceUid} &middot; {rm?.name ?? 'Unassigned'}
                          </p>
                          <p className="text-[11px] text-[#64748B] tabular-nums">
                            {dev.offlineQueueCount} tap{dev.offlineQueueCount === 1 ? '' : 's'} queued in flash memory
                          </p>
                        </div>
                      </div>
                      {dev.offlineQueueCount > 0 && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => syncDeviceOfflineBatch(dev.deviceUid)}
                        >
                          <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Sync</span>
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Unauthorized Taps */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[#0F172A]">
              Recent Denied / Unauthorized Cards ({deniedLogs.length})
            </h3>
            {deniedLogs.length === 0 ? (
              <p className="text-xs text-[#64748B] py-2">No unauthorized tap attempts recorded.</p>
            ) : (
              <div className="divide-y divide-[#E2E8F0] rounded-xl border border-[#E2E8F0] max-h-48 overflow-y-auto">
                {deniedLogs.map((log) => {
                  const rm = roomById.get(log.roomId);
                  return (
                    <div
                      key={log.id}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <AlertTriangle
                          className="h-4 w-4 text-[#DC2626] shrink-0"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="font-mono font-semibold text-[#0F172A] truncate">
                            {log.rfidUid}
                          </p>
                          <p className="text-[11px] text-[#64748B] truncate">
                            Denied at {rm?.name ?? 'Unknown Room'}
                          </p>
                        </div>
                      </div>
                      <span className="font-mono text-[11px] text-[#64748B] tabular-nums shrink-0">
                        {new Date(log.tappedAt).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Account Profile & Sign Out Modal */}
      <Modal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        title="NORMI Operator Profile"
        description="Authenticated session details and role-based access permissions."
        maxWidthClass="max-w-sm"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-[#1E5628]/25 bg-[#F2F7F3] p-4 space-y-1.5">
            <p className="text-sm font-bold text-[#0F172A]">{session?.name ?? 'System Operator'}</p>
            <p className="text-xs text-[#64748B]">{session?.email ?? ''}</p>
            <p className="text-xs font-medium text-[#1E5628] pt-1">
              Role: {session ? formatRoleLabel(session.role) : 'Operator'} &middot; Northern Mindanao Colleges, Inc.
            </p>
          </div>

          {session?.role === 'super_admin' && (
            <div className="pt-2 border-t border-[#E2E8F0] space-y-2">
              <p className="text-[11px] font-semibold text-[#64748B]">Operational Data Management</p>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-[#DC2626] border-[#DC2626]/30 hover:bg-[#DC2626]/10"
                onClick={() => {
                  if (
                    window.confirm(
                      'Are you sure you want to purge all operational records (logs, schedules, students, devices, rooms, colleges)? Super Admin will remain intact.'
                    )
                  ) {
                    purgeOperationalData();
                    setProfileOpen(false);
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1 text-[#DC2626]" aria-hidden="true" />
                <span>Purge Operational Records</span>
              </Button>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
            <Button variant="outline" size="md" onClick={() => setProfileOpen(false)}>
              Close
            </Button>
            <Button variant="destructive" size="md" onClick={handleLogout}>
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
