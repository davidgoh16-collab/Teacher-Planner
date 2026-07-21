import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { ToastMessage, subscribeToToasts } from '../../utils/notify';

const TOAST_TTL_MS = 6000;

/** Renders toasts emitted via utils/notify. Mount exactly once (App.tsx). */
const Toaster: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToToasts((toast) => {
      setToasts(prev => [...prev.slice(-3), toast]); // keep at most 4 on screen
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, TOAST_TTL_MS);
    });
    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2 max-w-md px-4 py-2.5 rounded-xl shadow-sm text-sm animate-in ${
            t.kind === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-slate-800 dark:bg-slate-700 text-white'
          }`}
          role="alert"
        >
          {t.kind === 'error'
            ? <AlertTriangle size={16} className="shrink-0" />
            : <CheckCircle2 size={16} className="shrink-0" />}
          <span className="flex-1">{t.text}</span>
          <button
            onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
            className="shrink-0 opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default Toaster;
