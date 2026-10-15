import { forwardRef } from 'react';

// variant: primary | secondary | ghost | danger. size: sm | md | lg.
// `loading` disables the button, shows a spinner and announces the busy state.
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
      {...props}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
});

// Icon-only button. `label` becomes both the accessible name and the hover tooltip.
export const IconButton = forwardRef(function IconButton(
  { label, size = 'md', className = '', type = 'button', children, ...props },
  ref,
) {
  const classes = ['icon-btn', size === 'sm' && 'icon-btn-sm', className].filter(Boolean).join(' ');
  return (
    <button ref={ref} type={type} className={classes} aria-label={label} title={props.title ?? label} {...props}>
      {children}
    </button>
  );
});
