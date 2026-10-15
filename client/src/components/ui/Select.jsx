import { useId } from 'react';

// A styled native <select>. Native selects keep full keyboard, screen reader and mobile
// picker support, which a custom dropdown would have to rebuild.
export function Select({ label, hideLabel = true, options, className = '', ...props }) {
  const id = useId();
  return (
    <span className={className}>
      <label className={hideLabel ? 'sr-only' : 'field-label'} htmlFor={id}>
        {label}
      </label>
      <select id={id} className="select" {...props}>
        {options.map(({ value, label: optionLabel }) => (
          <option key={value} value={value}>
            {optionLabel}
          </option>
        ))}
      </select>
    </span>
  );
}
