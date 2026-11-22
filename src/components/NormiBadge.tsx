import { ArrowDownLeft, ArrowUpRight, Clock, Minus } from 'lucide-react';
import { cn } from '../lib/utils';

export type NormiBadgeVariant =
  | 'present'
  | 'online'
  | 'occupied'
  | 'active'
  | 'time-in'
  | 'late'
  | 'absent'
  | 'denied'
  | 'unauthorized'
  | 'offline'
  | 'lost'
  | 'deactivated'
  | 'available'
  | 'time-out'
  | 'archived';

interface NormiBadgeProps {
  variant: NormiBadgeVariant;
  label?: string;
  className?: string;
}

const INDICATOR_CONFIG: Record<
  NormiBadgeVariant,
  {
    label: string;
    textClass: string;
    circleClass: string;
    icon: 'up' | 'down' | 'clock' | 'neutral';
  }
> = {
  present: {
    label: 'Present',
    textClass: 'text-[#1E5628]',
    circleClass: 'border-[#1E5628] text-[#1E5628]',
    icon: 'up',
  },
  online: {
    label: 'Online',
    textClass: 'text-[#1E5628]',
    circleClass: 'border-[#1E5628] text-[#1E5628]',
    icon: 'up',
  },
  occupied: {
    label: 'Occupied',
    textClass: 'text-[#1E5628]',
    circleClass: 'border-[#1E5628] text-[#1E5628]',
    icon: 'up',
  },
  active: {
    label: 'Active',
    textClass: 'text-[#1E5628]',
    circleClass: 'border-[#1E5628] text-[#1E5628]',
    icon: 'up',
  },
  'time-in': {
    label: 'Time-In',
    textClass: 'text-[#1E5628]',
    circleClass: 'border-[#1E5628] text-[#1E5628]',
    icon: 'up',
  },
  // Golden yellow accent used sparingly for Late status only
  late: {
    label: 'Late',
    textClass: 'text-[#B47209]',
    circleClass: 'border-[#F5A61C] text-[#B47209] bg-[#FEF6E6]',
    icon: 'clock',
  },
  absent: {
    label: 'Absent',
    textClass: 'text-[#DC2626]',
    circleClass: 'border-[#DC2626]/70 text-[#DC2626]',
    icon: 'down',
  },
  denied: {
    label: 'Denied',
    textClass: 'text-[#DC2626]',
    circleClass: 'border-[#DC2626]/70 text-[#DC2626]',
    icon: 'down',
  },
  unauthorized: {
    label: 'Unauthorized',
    textClass: 'text-[#DC2626]',
    circleClass: 'border-[#DC2626]/70 text-[#DC2626]',
    icon: 'down',
  },
  offline: {
    label: 'Offline',
    textClass: 'text-[#DC2626]',
    circleClass: 'border-[#DC2626]/70 text-[#DC2626]',
    icon: 'down',
  },
  lost: {
    label: 'Lost',
    textClass: 'text-[#DC2626]',
    circleClass: 'border-[#DC2626]/70 text-[#DC2626]',
    icon: 'down',
  },
  deactivated: {
    label: 'Deactivated',
    textClass: 'text-[#64748B]',
    circleClass: 'border-[#CBD5E1] text-[#64748B]',
    icon: 'neutral',
  },
  available: {
    label: 'Available',
    textClass: 'text-[#64748B]',
    circleClass: 'border-[#CBD5E1] text-[#64748B]',
    icon: 'neutral',
  },
  'time-out': {
    label: 'Time-Out',
    textClass: 'text-[#475569]',
    circleClass: 'border-[#94A3B8] text-[#475569]',
    icon: 'down',
  },
  archived: {
    label: 'Archived',
    textClass: 'text-[#64748B]',
    circleClass: 'border-[#CBD5E1] text-[#64748B]',
    icon: 'neutral',
  },
};

export function NormiBadge({ variant, label, className }: NormiBadgeProps) {
  const cfg = INDICATOR_CONFIG[variant];
  const Icon =
    cfg.icon === 'up'
      ? ArrowUpRight
      : cfg.icon === 'down'
      ? ArrowDownLeft
      : cfg.icon === 'clock'
      ? Clock
      : Minus;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0 tabular-nums',
        cfg.textClass,
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex h-4 w-4 items-center justify-center rounded-full border shrink-0',
          cfg.circleClass
        )}
      >
        <Icon className="h-2.5 w-2.5 stroke-[2.25]" />
      </span>
      <span>{label ?? cfg.label}</span>
    </span>
  );
}
