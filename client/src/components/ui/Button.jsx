import { forwardRef } from 'react';
import { Spinner } from './Spinner.jsx';

// variant: primary | secondary | ghost | danger. size: sm | md | lg.
// `loading` disables the button, shows a spinner and announces the busy state.
// `tooltip` (and optional `shortcut`, like "Mod+Enter") show in the shared tooltip.
export const Button = forwardRef(function Button(
  {
    variant = 'secondary',
    size = 'md',
    block = false,
    loading = false,
    icon,
    children,
    className = '',
    type = 'button',
    disabled,
    tooltip,
    shortcut,
    ...props
  },
  ref,
) {
  const classes = ['btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, block && 'btn-block', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-tooltip={tooltip}
      data-shortcut={tooltip ? shortcut : undefined}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
});

// Icon-only button. `label` is the accessible name and, unless `tooltip` says otherwise,
// the tooltip text. (`title` is accepted as the tooltip for older call sites.)
export const IconButton = forwardRef(function IconButton(
  { label, size = 'md', className = '', type = 'button', tooltip, title, shortcut, children, ...props },
  ref,
) {
  const classes = ['icon-btn', size === 'sm' && 'icon-btn-sm', className].filter(Boolean).join(' ');
  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      aria-label={label}
      data-tooltip={tooltip ?? title ?? label}
      data-shortcut={shortcut}
      {...props}
    >
      {children}
    </button>
  );
});
