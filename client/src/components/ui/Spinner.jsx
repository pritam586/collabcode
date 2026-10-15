// The branded loading ring. With a `label` it announces itself as a status; without one it is
// decorative and the surrounding text says what is loading.
export function Spinner({ size = 'sm', label }) {
  const className = `spinner ${size === 'lg' ? 'spinner-lg' : ''}`;
  if (!label) return <span className={className} aria-hidden="true" />;
  return (
    <span role="status">
      <span className={className} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
