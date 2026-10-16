import { forwardRef, useId } from 'react';
import { CircleAlert } from 'lucide-react';

// A labelled input (or textarea with `multiline`). Hints and errors are linked with
// aria-describedby so screen readers read them with the field. `action` (usually a button)
// sits beside the input on wider screens and below it on narrow ones. `mono` sets the input
// in the code font, for room codes and links.
export const TextField = forwardRef(function TextField(
  {
    label,
    hint,
    error,
    multiline = false,
    size = 'md',
    mono = false,
    action,
    className = '',
    hideLabel = false,
    id,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const Element = multiline ? 'textarea' : 'input';
  const input = (
    <Element
      ref={ref}
      id={inputId}
      className={['input', size === 'lg' && 'input-lg', mono && 'input-mono'].filter(Boolean).join(' ')}
      aria-invalid={error ? true : undefined}
      aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
      {...props}
    />
  );

  return (
    <div className={`field ${className}`.trim()}>
      <label className={hideLabel ? 'sr-only' : 'field-label'} htmlFor={inputId}>
        {label}
      </label>
      {action ? (
        <div className="field-row">
          {input}
          {action}
        </div>
      ) : (
        input
      )}
      {hint && !error && (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={errorId} role="alert">
          <CircleAlert size={14} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
});
