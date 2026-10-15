import { useEffect, useState } from 'react';

// Must match the breakpoints in app.css.
export const COMPACT_QUERY = '(max-width: 767px)';
export const TOUCH_QUERY = '(pointer: coarse)';

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches ?? false);

  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return undefined;
    const handleChange = (event) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener('change', handleChange);
    return () => list.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
}

export const isTouchDevice = () => window.matchMedia?.(TOUCH_QUERY).matches ?? false;
