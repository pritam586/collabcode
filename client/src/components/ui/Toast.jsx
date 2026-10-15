import { useCallback, useMemo, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { IconButton } from './Button.jsx';
import { ToastContext } from './useToast.js';

const ICONS = { success: CircleCheck, error: CircleAlert, warning: TriangleAlert, info: Info };
const DURATIONS = { success: 3500, info: 4500, warning: 7000, error: 8000 };

// Toasts announce through two live regions: errors are assertive (role="alert"), the rest
// polite. Hovering or focusing a toast pauses its timer so it can be read.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const schedule = useCallback((id, type) => {
    clearTimeout(timers.current.get(id));
    timers.current.set(id, setTimeout(() => dismiss(id), DURATIONS[type]));
  }, [dismiss]);

  const show = useCallback((type, message, { id = crypto.randomUUID() } = {}) => {
    // Reusing an id replaces that toast instead of stacking duplicates (e.g. "Reconnecting").
    setToasts((current) => [...current.filter((toast) => toast.id !== id), { id, type, message }].slice(-4));
    schedule(id, type);
    return id;
  }, [schedule]);

  const api = useMemo(() => ({
    success: (message, options) => show('success', message, options),
    error: (message, options) => show('error', message, options),
    warning: (message, options) => show('warning', message, options),
    info: (message, options) => show('info', message, options),
    dismiss,
  }), [show, dismiss]);

  const renderToast = (toast) => {
    const Icon = ICONS[toast.type];
    return (
      <div
        key={toast.id}
        className={`toast toast-${toast.type}`}
        onMouseEnter={() => clearTimeout(timers.current.get(toast.id))}
        onMouseLeave={() => schedule(toast.id, toast.type)}
        onFocus={() => clearTimeout(timers.current.get(toast.id))}
        onBlur={() => schedule(toast.id, toast.type)}
      >
        <Icon className="toast-icon" size={18} aria-hidden="true" />
        <p className="toast-message">{toast.message}</p>
        <IconButton label="Dismiss notification" size="sm" onClick={() => dismiss(toast.id)}><X size={16} aria-hidden="true" /></IconButton>
      </div>
    );
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region">
        <div role="alert">{toasts.filter((toast) => toast.type === 'error').map(renderToast)}</div>
        <div role="status" aria-live="polite">{toasts.filter((toast) => toast.type !== 'error').map(renderToast)}</div>
      </div>
    </ToastContext.Provider>
  );
}
