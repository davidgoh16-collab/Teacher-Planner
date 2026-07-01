/**
 * Minimal app-wide toast emitter. Services (which have no React context) call notifyError /
 * notifySuccess; the single <Toaster /> mounted in App.tsx subscribes and renders. Module-level
 * on purpose — no provider plumbing needed at ~40 existing call sites.
 */

export interface ToastMessage {
  id: number;
  kind: 'error' | 'success';
  text: string;
}

type Listener = (toast: ToastMessage) => void;

let nextId = 1;
const listeners = new Set<Listener>();

export const subscribeToToasts = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

const emit = (kind: ToastMessage['kind'], text: string) => {
  const toast: ToastMessage = { id: nextId++, kind, text };
  listeners.forEach(l => l(toast));
};

export const notifyError = (text: string) => emit('error', text);
export const notifySuccess = (text: string) => emit('success', text);
