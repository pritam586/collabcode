const COLORS = new Set(['violet', 'cyan', 'amber', 'rose', 'lime', 'sky']);

export function initials(name = '') {
  return name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';
}

// Decorative by default: the person's name is always shown next to it.
export function Avatar({ name, color, size = 'md', title }) {
  const safeColor = COLORS.has(color) ? color : 'violet';
  return (
    <span className={`avatar avatar-${safeColor} ${size === 'sm' ? 'avatar-sm' : ''}`} aria-hidden={title ? undefined : true} title={title}>
      {initials(name)}
    </span>
  );
}
