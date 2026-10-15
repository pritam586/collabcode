import { useCallback, useEffect, useId, useRef, useState } from 'react';

// A button that opens a small panel of controls (disclosure pattern). Escape, a click outside
// or `close()` (passed to children) closes it. Focus returns to the button unless the click
// outside moved it somewhere else on purpose.
export function Popover({ label, icon, children, align = 'end', buttonProps = {} }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    const button = buttonRef.current;
    let returnFocus = true;
    panelRef.current?.querySelector('button, select, input, [tabindex="0"]')?.focus();

    function handlePointerDown(event) {
      if (rootRef.current?.contains(event.target)) return;
      returnFocus = false;
      setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      if (returnFocus && button?.isConnected) button.focus();
    };
  }, [open]);

  return (
    <div className="popover" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="icon-btn"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        {...buttonProps}
      >
        {icon}
      </button>
      <div ref={panelRef} id={panelId} className={`popover-panel popover-${align}`} hidden={!open} role="group" aria-label={label}>
        {open && children({ close })}
      </div>
    </div>
  );
}
