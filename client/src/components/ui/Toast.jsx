import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { IconButton } from './Button.jsx';
import { ToastContext } from './useToast.js';

const ICONS = { success: CircleCheck, error: CircleAlert, warning: TriangleAlert, info: Info };
const DURATIONS = { success: 3500, info: 4500, warning: 7000, error: 8000 };
// How long a dismissed toast takes to slide out (matches the toast-out animation).
const EXIT_MS = 200;
// Where the Popover API is missing, the region stays an ordinary fixed element (a `popover`
// attribute it cannot open would hide it).
const SUPPORTS_POPOVER = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;

// Toasts announce through two live regions: errors are assertive (role="alert"), the rest
// polite. Hovering or focusing a toast pauses its timer so it can be read.
//
// The region is a manual popover, so it lives in the browser's top layer: a toast raised while
// a modal dialog is open (say, "Link copied" from the Share dialog) appears above the dialog
// instead of under its backdrop. The region stays open, so its live regions always exist.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const regionRef = useRef(null);
  const count = toasts.length;

  useLayoutEffect(() => {
    const region = regionRef.current;
    if (typeof region?.showPopover !== 'function') return;
    if (!region.matches(':popover-open')) region.showPopover();
    else if (count > 0 && document.querySelector('dialog:modal')) {
      // A dialog opened after the region sits above it; re-showing moves the region to the top.
      region.hidePopover();
      region.showPopover();
    }
  }, [count]);

  // A dismissed toast is marked as leaving, slides out, then is removed.
  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    setToasts((current) => current.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)));
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, EXIT_MS),
    );
  }, []);

  const schedule = useCallback(
    (id, type) => {
      clearTimeout(timers.current.get(id));
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DURATIONS[type]),
      );
    },
    [dismiss],
  );

  const show = useCallback(
    (type, message, { id = crypto.randomUUID() } = {}) => {
      // Reusing an id replaces that toast instead of stacking duplicates (e.g. "Reconnecting").
      setToasts((current) => [...current.filter((toast) => toast.id !== id), { id, type, message }].slice(-4));
      schedule(id, type);
      return id;
    },
    [schedule],
  );

  const api = useMemo(
    () => ({
      success: (message, options) => show('success', message, options),
      error: (message, options) => show('error', message, options),
      warning: (message, options) => show('warning', message, options),
      info: (message, options) => show('info', message, options),
      dismiss,
    }),
    [show, dismiss],
  );

  const renderToast = (toast) => {
    const Icon = ICONS[toast.type];
    return (
      <div
        key={toast.id}
        className={`toast toast-${toast.type}`}
        data-leaving={toast.leaving || undefined}
        onMouseEnter={() => !toast.leaving && clearTimeout(timers.current.get(toast.id))}
        onMouseLeave={() => !toast.leaving && schedule(toast.id, toast.type)}
        onFocus={() => !toast.leaving && clearTimeout(timers.current.get(toast.id))}
        onBlur={() => !toast.leaving && schedule(toast.id, toast.type)}
      >
        <Icon className="toast-icon" size={18} aria-hidden="true" />
        <p className="toast-message">{toast.message}</p>
        <IconButton label="Dismiss notification" size="sm" onClick={() => dismiss(toast.id)}>
          <X size={16} aria-hidden="true" />
        </IconButton>
      </div>
    );
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" popover={SUPPORTS_POPOVER ? 'manual' : undefined} ref={regionRef}>
        <div role="alert">{toasts.filter((toast) => toast.type === 'error').map(renderToast)}</div>
        <div role="status" aria-live="polite">
          {toasts.filter((toast) => toast.type !== 'error').map(renderToast)}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
