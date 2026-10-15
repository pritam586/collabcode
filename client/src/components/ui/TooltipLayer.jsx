import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Shortcut } from './Kbd.jsx';

const SHOW_DELAY_MS = 450;
const HIDE_DELAY_MS = 100;
const GAP = 8;
const EDGE = 8;

// One tooltip for the whole app. Any element with data-tooltip="Text" (and optionally
// data-shortcut="Mod+Enter" or data-tooltip-placement="bottom") gets it on mouse hover or
// keyboard focus, so components need no wrapper elements. Following WCAG 1.4.13, it can be
// dismissed with Escape and stays open while the pointer is over it. When the text adds to
// the element's accessible name, it is linked with aria-describedby. Inside an open <dialog>
// the bubble renders in the dialog, because the page below a modal is covered by it.
export function TooltipLayer() {
  const [tip, setTip] = useState(null);
  const bubbleRef = useRef(null);
  const id = useId();

  useEffect(() => {
    let showTimer;
    let hideTimer;
    let current = null;
    let keyboard = false;

    const findTarget = (node) => (node instanceof Element ? node.closest('[data-tooltip]') : null);

    function show(target) {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      const text = target.getAttribute('data-tooltip');
      if (!text || !target.isConnected) return;
      current = target;
      const dialog = target.closest('dialog[open]');
      setTip({
        target,
        text,
        container: dialog ?? document.body,
        shortcut: target.getAttribute('data-shortcut'),
        // A dialog clips its content, so prefer the room below the control there.
        placement: target.getAttribute('data-tooltip-placement') ?? (dialog ? 'bottom' : 'top'),
      });
    }
    function hide() {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      current = null;
      setTip(null);
    }
    function scheduleHide() {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hide, HIDE_DELAY_MS);
    }

    function handlePointerOver(event) {
      if (event.pointerType === 'touch') return;
      const target = findTarget(event.target);
      if (target && target === current) {
        clearTimeout(hideTimer);
        return;
      }
      if (!target) {
        if (bubbleRef.current?.contains(event.target)) clearTimeout(hideTimer);
        else if (current) scheduleHide();
        return;
      }
      clearTimeout(showTimer);
      // Moving between tooltipped controls feels instant once one tooltip is showing.
      if (current) show(target);
      else showTimer = setTimeout(() => show(target), SHOW_DELAY_MS);
    }
    function handlePointerOut(event) {
      if (!event.relatedTarget) scheduleHide();
    }
    function handleFocusIn(event) {
      const target = findTarget(event.target);
      if (target && keyboard) show(target);
      else if (current) hide();
    }
    function handleFocusOut(event) {
      if (current?.contains(event.target)) hide();
    }
    function handleKeyDown(event) {
      keyboard = true;
      if (event.key === 'Escape' && current) hide();
    }
    function handlePointerDown() {
      keyboard = false;
      if (current) hide();
    }

    document.addEventListener('pointerover', handlePointerOver);
    document.addEventListener('pointerout', handlePointerOut);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      document.removeEventListener('pointerover', handlePointerOver);
      document.removeEventListener('pointerout', handlePointerOut);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, []);

  // Place the bubble above the target (or below when there is no room), kept on screen, and
  // describe the target with it while it is open.
  useLayoutEffect(() => {
    const bubble = bubbleRef.current;
    if (!tip || !bubble) return undefined;
    const { target, text, placement, container } = tip;
    const anchor = target.getBoundingClientRect();
    const size = bubble.getBoundingClientRect();
    const above = anchor.top - GAP - size.height;
    const below = anchor.bottom + GAP;
    const top =
      placement === 'bottom'
        ? below + size.height > window.innerHeight - EDGE
          ? above
          : below
        : above < EDGE
          ? below
          : above;
    const centered = anchor.left + anchor.width / 2 - size.width / 2;
    const left = Math.min(Math.max(centered, EDGE), window.innerWidth - size.width - EDGE);
    // A dialog is the containing block for its fixed-position content, so offset by its corner.
    const box = container === document.body ? null : container.getBoundingClientRect();
    const x = left - (box ? box.left + container.clientLeft : 0);
    const y = top - (box ? box.top + container.clientTop : 0);
    bubble.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;

    const name = target.getAttribute('aria-label') ?? target.textContent.trim();
    if (text === name) return undefined;
    const previous = target.getAttribute('aria-describedby');
    target.setAttribute('aria-describedby', [previous, bubble.id].filter(Boolean).join(' '));
    return () => {
      if (previous) target.setAttribute('aria-describedby', previous);
      else target.removeAttribute('aria-describedby');
    };
  }, [tip]);

  if (!tip) return null;
  return createPortal(
    <div ref={bubbleRef} id={`${id}-tooltip`} role="tooltip" className="tooltip">
      <span>{tip.text}</span>
      {tip.shortcut && <Shortcut keys={tip.shortcut} />}
    </div>,
    tip.container,
  );
}
