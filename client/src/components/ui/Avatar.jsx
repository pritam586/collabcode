const COLORS = new Set(['violet', 'cyan', 'amber', 'rose', 'lime', 'sky']);
const SIZES = { sm: 'avatar-sm', md: '', lg: 'avatar-lg' };

function initials(name = '') {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  );
}

// Decorative by default: the person's name is always shown next to it, or in the label of
// the group it belongs to. `status` adds a presence dot: 'online' or 'typing'.
export function Avatar({ name, color, size = 'md', status, tooltip }) {
  const safeColor = COLORS.has(color) ? color : 'violet';
  return (
    <span
      className={['avatar', `avatar-${safeColor}`, SIZES[size]].filter(Boolean).join(' ')}
      aria-hidden="true"
      data-tooltip={tooltip}
    >
      {initials(name)}
      {status && <span className={`avatar-status avatar-status-${status}`} />}
    </span>
  );
}

// Overlapping avatars with a "+N" for the rest. The group's label lists everyone, so screen
// readers get the names the tooltips show.
export function AvatarStack({ people, max = 4, size = 'md', label }) {
  const shown = people.slice(0, max);
  const hidden = people.length - shown.length;
  const names = people.map((person) => person.name).join(', ');
  return (
    <span className="avatar-stack" role="img" aria-label={label ?? names}>
      {shown.map((person) => (
        <Avatar key={person.id} name={person.name} color={person.color} size={size} tooltip={person.name} />
      ))}
      {hidden > 0 && (
        <span
          className={['avatar', 'avatar-overflow', SIZES[size]].filter(Boolean).join(' ')}
          aria-hidden="true"
          data-tooltip={people
            .slice(max)
            .map((person) => person.name)
            .join(', ')}
        >
          +{hidden}
        </span>
      )}
    </span>
  );
}
