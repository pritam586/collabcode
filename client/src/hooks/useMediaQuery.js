import { useCallback, useSyncExternalStore } from 'react';

// Must match the breakpoints in app.css.
export const COMPACT_QUERY = '(max-width: 767px)';
export const TOUCH_QUERY = '(pointer: coarse)';

export function useMediaQuery(query) {
  const subscribe = useCallback((onChange) => {
    const list = window.matchMedia?.(query);
    list?.addEventListener('change', onChange);
    return () => list?.removeEventListener('change', onChange);
  }, [query]);
  return useSyncExternalStore(subscribe, () => window.matchMedia?.(query).matches ?? false);
}
