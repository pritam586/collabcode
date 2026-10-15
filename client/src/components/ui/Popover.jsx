import { useEffect, useId, useRef, useState } from 'react';

// A button that opens a small panel of controls (disclosure pattern). Escape or a click
// outside closes it and returns focus to the button. `children` receives { close }.
export function Popover({ label, icon, children, align = 'end', buttonProps = {} }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.querySelector('button, select, input, [tabindex="0"]')?.focus();

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

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
