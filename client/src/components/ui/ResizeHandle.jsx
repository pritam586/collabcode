import { useRef } from 'react';

const STEP = 16;
const BIG_STEP = 64;

// A divider that resizes the panel next to it (WAI-ARIA window splitter). Drag it, or focus it
// and use the arrow keys (Shift for bigger steps), Home and End; double-click or Enter resets.
// orientation 'vertical' is a vertical line between side-by-side panels; 'horizontal' sits
// between stacked panels. `value` is the panel's size in pixels. `invert` is for a panel on
// the right or bottom, which grows as the divider moves left or up.
export function ResizeHandle({
  label,
  orientation = 'vertical',
  value,
  min,
  max,
  onChange,
  onReset,
  invert = false,
  controls,
  className = '',
}) {
  const dragRef = useRef(null);
  const clamp = (size) => Math.round(Math.min(max, Math.max(min, size)));
  const move = (delta) => onChange(clamp(value + (invert ? -delta : delta)));

  function handlePointerDown(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { start: orientation === 'vertical' ? event.clientX : event.clientY, size: value };
    document.body.dataset.resizing = orientation;
  }
  function handlePointerMove(event) {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = (orientation === 'vertical' ? event.clientX : event.clientY) - drag.start;
    onChange(clamp(drag.size + (invert ? -delta : delta)));
  }
  function stopDrag() {
    dragRef.current = null;
    delete document.body.dataset.resizing;
  }

  function handleKeyDown(event) {
    const step = event.shiftKey ? BIG_STEP : STEP;
    const keys =
      orientation === 'vertical' ? { ArrowLeft: -step, ArrowRight: step } : { ArrowUp: -step, ArrowDown: step };
    if (event.key in keys) move(keys[event.key]);
    else if (event.key === 'Home') onChange(min);
    else if (event.key === 'End') onChange(max);
    else if (event.key === 'Enter' && onReset) onReset();
    else return;
    event.preventDefault();
  }

  return (
    // A focusable separator is an interactive widget (WAI-ARIA window splitter), which the
    // plugin cannot tell apart from a static divider.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={orientation}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-controls={controls}
      className={`resize-handle resize-handle-${orientation} ${className}`.trim()}
      data-tooltip={label}
      data-tooltip-placement={orientation === 'vertical' ? undefined : 'top'}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onLostPointerCapture={stopDrag}
      onDoubleClick={onReset}
      onKeyDown={handleKeyDown}
    />
  );
}
