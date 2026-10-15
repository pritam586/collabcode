// Small presentational pieces: badges, skeleton placeholders and empty states.

// tone: neutral | accent | brand | soft | success | warning | danger | outline.
// `dot` adds a status dot in the text color.
export function Badge({ tone = 'neutral', dot = false, className = '', children, ...props }) {
  const classes = ['badge', tone !== 'neutral' && `badge-${tone}`, dot && 'badge-dot', className]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
}

// A loading placeholder. Decorative: whatever shows it also announces the loading state.
export function Skeleton({ width, height, circle = false, className = '' }) {
  const classes = ['skeleton', circle && 'skeleton-circle', className].filter(Boolean).join(' ');
  return <span className={classes} style={{ width, height }} aria-hidden="true" />;
}

// An empty panel: what the space is for, and what to do first.
export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="empty-state">
      {Icon && (
        <span className="empty-state-icon" aria-hidden="true">
          <Icon size={20} />
        </span>
      )}
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
