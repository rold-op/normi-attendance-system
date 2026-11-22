import { Link, NavLink } from 'react-router-dom';
import {
  Building2,
  CalendarCheck,
  Cpu,
  FileText,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { NormiLogo } from './NormiLogo';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS = [
  {
    label: 'Lab Monitoring',
    to: '/dashboard/monitoring',
    icon: Monitor,
  },
  {
    label: 'Subject Schedule & Attendance',
    to: '/dashboard/schedules',
    icon: CalendarCheck,
  },
  {
    label: 'Colleges',
    to: '/dashboard/colleges',
    icon: Building2,
  },
  {
    label: 'Students & RFID',
    to: '/dashboard/students',
    icon: Users,
  },
  {
    label: 'Access Logs & Reports',
    to: '/dashboard/logs',
    icon: FileText,
  },
  {
    label: 'Devices & Rooms',
    to: '/dashboard/devices',
    icon: Cpu,
  },
];

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const { session } = useAuth();
  const isSuperAdmin = session?.role === 'super_admin';

  const visibleNavItems = isSuperAdmin
    ? [
        ...NAV_ITEMS,
        {
          label: 'Users',
          to: '/dashboard/users',
          icon: UserCog,
        },
      ]
    : NAV_ITEMS;

  const renderSidebarInner = (isCompact: boolean) => (
    <div className="flex h-full flex-col bg-[#FFFFFF] border-r border-black/[0.06]">
      {/* Top NORMI Brand Header (Clicking routes to main dashboard) */}
      <div
        className={cn(
          'flex h-[68px] items-center shrink-0 border-b border-black/[0.04]',
          isCompact ? 'justify-center px-2' : 'justify-between px-5'
        )}
      >
        <Link
          to="/dashboard/monitoring"
          onClick={onCloseMobile}
          aria-label="NORMI Attendance System Dashboard"
          className={cn(
            'flex items-center min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E5628] rounded-xl apple-press',
            isCompact ? 'justify-center' : 'gap-3'
          )}
        >
          <NormiLogo size="sidebar" />
          {!isCompact && (
            <div className="min-w-0">
              <p className="text-sm font-bold uppercase tracking-tight text-[#0F172A] leading-none truncate">
                NORMI
              </p>
              <p className="text-[11px] font-medium text-[#64748B] leading-tight mt-1 truncate tracking-tight">
                Attendance System
              </p>
            </div>
          )}
        </Link>

        {!isCompact && (
          <>
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              className="hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#EAF2EC] hover:text-[#1E5628] transition-colors shrink-0"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
              className="lg:hidden inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#EAF2EC] hover:text-[#1E5628] transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Expand Trigger when Collapsed */}
      {isCompact && (
        <div className="flex justify-center pb-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Expand sidebar"
            aria-label="Expand sidebar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#EAF2EC] hover:text-[#1E5628] transition-colors"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation List (Solid Forest Green Active Block; Users shown for Super Admin only) */}
      <nav
        aria-label="Primary navigation"
        className={cn('flex-1 py-3 space-y-1.5 overflow-y-auto', isCompact ? 'px-2.5' : 'px-4')}
      >
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={isCompact ? item.label : undefined}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                cn(
                  'group flex items-center rounded-xl text-xs font-medium transition-all duration-150 apple-press tracking-tight',
                  isCompact ? 'justify-center h-10 w-full px-0' : 'gap-3 px-3.5 py-2.5',
                  isActive
                    ? 'bg-[#1E5628] text-white font-medium shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_rgba(30,86,40,0.18)]'
                    : 'text-[#334155] hover:bg-[#F4F6F4] hover:text-[#1E5628]'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      'h-[18px] w-[18px] shrink-0 stroke-[1.8]',
                      isActive ? 'text-white' : 'text-[#334155] group-hover:text-[#1E5628]'
                    )}
                    aria-hidden="true"
                  />
                  {!isCompact && <span className="truncate">{item.label}</span>}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          'hidden lg:block lg:shrink-0 lg:sticky lg:top-0 lg:h-screen transition-all duration-150 no-print',
          collapsed ? 'lg:w-[76px]' : 'lg:w-[258px]'
        )}
      >
        {renderSidebarInner(collapsed)}
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden flex bg-[#0F172A]/40 no-print"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onCloseMobile();
          }}
        >
          <aside className="w-[264px] max-w-[85vw] h-full">{renderSidebarInner(false)}</aside>
        </div>
      )}
    </>
  );
}
