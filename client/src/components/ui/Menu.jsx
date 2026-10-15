import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Shortcut } from './Kbd.jsx';

const enabledItems = (panel) => [...(panel?.querySelectorAll('[role^="menuitem"]:not([aria-disabled="true"])') ?? [])];

// A dropdown menu of actions (WAI-ARIA menu button pattern). The trigger opens it with a
// click, Enter, Space or the arrow keys; inside, arrows, Home, End and the first letter of an
// item move focus, Enter or Space chooses, and Escape closes and returns to the trigger.
//
// items: { id, label, icon?, shortcut?, onSelect, checked?, danger?, disabled? } for actions
// (`checked` true/false makes it a checkbox item), { id, type: 'separator' } and
// { id, type: 'label', label } for structure. variant 'icon' shows only `icon`, named by
// `label`; 'button' shows `icon` and `children` in a secondary button.
export function Menu({ label, icon, children, items, align = 'end', variant = 'icon', triggerClassName = '' }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const startRef = useRef('first');

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  function openAt(start) {
    startRef.current = start;
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return undefined;
    const items = enabledItems(panelRef.current);
    (startRef.current === 'last' ? items.at(-1) : items[0])?.focus();
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  function handleTriggerKeyDown(event) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    openAt(event.key === 'ArrowUp' ? 'last' : 'first');
  }

  function handleMenuKeyDown(event) {
    const items = enabledItems(panelRef.current);
    const index = items.indexOf(document.activeElement);
    const focus = (next) => items[(next + items.length) % items.length]?.focus();
    if (event.key === 'ArrowDown') focus(index + 1);
    else if (event.key === 'ArrowUp') focus(index - 1);
    else if (event.key === 'Home') focus(0);
    else if (event.key === 'End') focus(items.length - 1);
    else if (event.key === 'Escape') {
      // Keep Escape from also closing a dialog the menu sits in.
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      setOpen(false);
      return;
    } else if (event.key.length === 1 && /\S/.test(event.key)) {
      const letter = event.key.toLowerCase();
      const ordered = [...items.slice(index + 1), ...items.slice(0, index + 1)];
      ordered.find((item) => item.textContent.trim().toLowerCase().startsWith(letter))?.focus();
    } else return;
    event.preventDefault();
  }

  const isIcon = variant === 'icon';
  return (
    <div className="menu-root" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`${isIcon ? 'icon-btn' : 'btn btn-secondary'} ${triggerClassName}`.trim()}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={isIcon ? label : undefined}
        data-tooltip={isIcon && !open ? label : undefined}
        onClick={() => (open ? close(false) : openAt('first'))}
        onKeyDown={handleTriggerKeyDown}
      >
        {icon}
        {!isIcon && children}
      </button>
      {open && (
        <div
          ref={panelRef}
          id={menuId}
          role="menu"
          aria-label={label}
          className={`menu-panel menu-${align}`}
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item) =>
            item.type === 'separator' ? (
              <div key={item.id} role="separator" className="menu-separator" />
            ) : item.type === 'label' ? (
              <div key={item.id} className="menu-label" aria-hidden="true">
                {item.label}
              </div>
            ) : (
              <MenuItem
                key={item.id}
                item={item}
                onChoose={() => {
                  close();
                  item.onSelect?.();
                }}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ item, onChoose }) {
  const Icon = item.icon;
  const checkable = item.checked !== undefined;
  return (
    <button
      type="button"
      role={checkable ? 'menuitemcheckbox' : 'menuitem'}
      aria-checked={checkable ? item.checked : undefined}
      aria-disabled={item.disabled || undefined}
      tabIndex={-1}
      className={item.danger ? 'menu-item menu-item-danger' : 'menu-item'}
      onClick={() => !item.disabled && onChoose()}
    >
      {checkable ? (
        <Check className="menu-item-check" size={16} aria-hidden="true" />
      ) : (
        Icon && <Icon size={16} aria-hidden="true" />
      )}
      <span className="menu-item-label">{item.label}</span>
      {item.shortcut && (
        <span aria-hidden="true">
          <Shortcut keys={item.shortcut} />
        </span>
      )}
    </button>
  );
}
