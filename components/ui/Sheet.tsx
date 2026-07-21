import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// The app-wide modal wrapper: bottom sheet on mobile (<md), centered dialog
// on desktop. Handles backdrop click, Escape, body scroll-lock and focus.
interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: 'md' | 'lg' | 'xl' | '2xl';
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

const SIZE_CLASS: Record<NonNullable<SheetProps['size']>, string> = {
  md: 'md:max-w-lg',
  lg: 'md:max-w-2xl',
  xl: 'md:max-w-3xl',
  '2xl': 'md:max-w-5xl',
};

const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  headerActions,
  footer,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/30 dark:bg-black/50 backdrop-blur-[2px] animate-fade-in md:flex md:items-center md:justify-center md:p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`fixed inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-2xl bg-white outline-none animate-sheet-up
          dark:bg-slate-800
          md:static md:max-h-[85vh] md:w-full md:animate-fade-in md:rounded-2xl md:border md:border-black/[0.06] md:shadow-sm md:dark:border-white/[0.08]
          ${SIZE_CLASS[size]}`}
      >
        <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600 md:hidden" />
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            <button
              onClick={onClose}
              aria-label="Close"
              className="-m-2 flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-black/[0.06] px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:border-white/[0.08] md:pb-4">
            {footer}
          </div>
        )}
        {!footer && <div className="h-[env(safe-area-inset-bottom)] shrink-0 md:hidden" />}
      </div>
    </div>,
    document.body
  );
};

export default Sheet;
