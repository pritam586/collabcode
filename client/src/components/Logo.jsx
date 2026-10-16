import { useId } from 'react';

// The CollabCode mark: a code glyph on the signature gradient. Decorative; the wordmark or the
// surrounding control names it.
export function LogoMark({ size = 28 }) {
  const gradientId = useId();
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset="0.6" stopColor="#2563eb" />
          <stop offset="1" stopColor="#0891b2" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gradientId})`} />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="none" stroke="#fff" strokeOpacity="0.18" />
      <path
        d="M12 10.5 6.5 16l5.5 5.5M20 10.5l5.5 5.5-5.5 5.5M17.6 8.5l-3.2 15"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ showName = true }) {
  return (
    <span className="brand">
      <LogoMark />
      {showName && <span className="brand-name">CollabCode</span>}
    </span>
  );
}
