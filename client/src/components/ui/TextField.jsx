import { forwardRef, useId } from 'react';

// A labelled input (or textarea with `multiline`). Hints and errors are linked with
// aria-describedby so screen readers read them with the field.
export const TextField = forwardRef(function TextField(
  { label, hint, error, multiline = false, size = 'md', className = '', hideLabel = false, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const Element = multiline ? 'textarea' : 'input';

  return (
    <div className={`field ${className}`}>
      <label className={hideLabel ? 'sr-only' : 'field-label'} htmlFor={inputId}>{label}</label>
      <Element
        ref={ref}
        id={inputId}
        className={`input ${size === 'lg' ? 'input-lg' : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        {...props}
      />
      {hint && !error && <p className="field-hint" id={hintId}>{hint}</p>}
      {error && <p className="field-error" id={errorId} role="alert">{error}</p>}
    </div>
  );
});
