import { cn } from '../lib/utils';

export type NormiLogoSize = 'sm' | 'md' | 'lg' | 'sidebar' | 'login' | 'kiosk' | 'print';

interface NormiLogoProps {
  size?: NormiLogoSize;
  onDarkSurface?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NormiLogoSize, string> = {
  sm: 'w-10 h-10',
  sidebar: 'w-10 h-10',
  md: 'w-14 h-14',
  kiosk: 'w-14 h-14',
  print: 'w-[60px] h-[60px]',
  lg: 'w-24 h-24',
  login: 'w-24 h-24',
};

export function NormiLogo({
  size = 'sidebar',
  onDarkSurface = false,
  className,
}: NormiLogoProps) {
  return (
    <div
      className={cn(
        'relative aspect-square rounded-full flex items-center justify-center shrink-0 select-none',
        onDarkSurface ? 'bg-white p-0.5 shadow-sm' : 'bg-white',
        SIZE_CLASSES[size],
        className
      )}
    >
      <img
        src="/images/normi-logo.png"
        alt="Northern Mindanao Colleges, Inc. (NORMI) Official Logo"
        decoding="async"
        className="w-full h-full aspect-square object-contain"
      />
    </div>
  );
}
