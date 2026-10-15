import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './Button.jsx';

// A modal built on the native <dialog> element, which traps focus, closes on Escape and makes
// the rest of the page inert. Focus returns to whatever was focused before it opened.
export function Modal({ open, title, onClose, children, dismissible = true, initialFocusRef, wide = false }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    if (open && !dialog.open) {
      const previouslyFocused = document.activeElement;
      dialog.showModal();
      initialFocusRef?.current?.focus();
      return () => {
        if (dialog.open) dialog.close();
        if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
      };
    }
    return undefined;
  }, [open, initialFocusRef]);

  // A click on the backdrop lands on the <dialog> element itself. This is a pointer
  // convenience only; keyboard users close with Escape or the Close button.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog || !dismissible) return undefined;
    const handleClick = (event) => {
      if (event.target === dialog) onClose?.();
    };
    dialog.addEventListener('click', handleClick);
    return () => dialog.removeEventListener('click', handleClick);
  }, [open, dismissible, onClose]);

  function handleCancel(event) {
    // Escape key. Non-dismissible dialogs (like the name prompt) must be answered.
    event.preventDefault();
    if (dismissible) onClose?.();
  }

  if (!open) return null;
  return (
    <dialog
      ref={dialogRef}
      className={wide ? 'modal modal-wide' : 'modal'}
      aria-labelledby={titleId}
      onCancel={handleCancel}
    >
      <div className="modal-header">
        <h2 className="modal-title" id={titleId}>
          {title}
        </h2>
        {dismissible && (
          <IconButton label="Close" size="sm" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </IconButton>
        )}
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
