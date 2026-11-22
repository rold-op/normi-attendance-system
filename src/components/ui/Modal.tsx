import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidthClass = 'max-w-lg',
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/30 backdrop-blur-sm transition-all"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          'w-full bg-white rounded-2xl shadow-[0_20px_50px_rgba(15,23,42,0.14)] border border-black/[0.08] overflow-hidden',
          maxWidthClass
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-black/[0.06]">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-base font-semibold text-[#0F172A] tracking-tight">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-xs text-[#64748B] leading-relaxed">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="apple-press inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6 max-h-[82vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
