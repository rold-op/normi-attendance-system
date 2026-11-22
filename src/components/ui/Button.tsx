import React from 'react';
import { cn } from '../../lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[#1E5628] text-white border border-[#1E5628] hover:bg-[#16421E] active:bg-[#113518] shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_rgba(30,86,40,0.18)] disabled:bg-[#94A3B8] disabled:border-[#94A3B8] disabled:shadow-none',
  secondary:
    'bg-[#EAF2EC] text-[#1E5628] border border-[#1E5628]/20 hover:bg-[#DCEAE0]',
  outline:
    'bg-white text-[#0F172A] border border-black/[0.08] hover:bg-[#F4F6F4] hover:border-black/[0.14] shadow-sm',
  ghost:
    'bg-transparent text-[#64748B] border border-transparent hover:bg-[#EAF2EC]/60 hover:text-[#1E5628]',
  destructive:
    'bg-white text-[#DC2626] border border-[#FECACA] hover:bg-[#FEF2F2] hover:border-[#DC2626]',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg tracking-tight',
  md: 'h-9 px-3.5 text-xs font-medium gap-2 rounded-xl tracking-tight',
  lg: 'h-10 px-4 text-sm font-medium gap-2 rounded-xl tracking-tight',
  icon: 'h-9 w-9 p-0 justify-center rounded-xl',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center font-medium whitespace-nowrap shrink-0 apple-press select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E5628] focus-visible:ring-offset-1',
          'disabled:pointer-events-none disabled:opacity-45',
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
