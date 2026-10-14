import { useCallback, useEffect, useState } from 'react';

// The app has two screens, so a tiny history-based router is enough:
//   /            -> { name: 'home' }
//   /r/<roomId>  -> { name: 'room', roomId }
// Production hosting must serve index.html for /r/* paths (Vite's dev server already does).
function parseLocation() {
  const match = window.location.pathname.match(/^\/r\/([^/]+)\/?$/);
  if (match) {
    try {
      return { name: 'room', roomId: decodeURIComponent(match[1]) };
    } catch {
      return { name: 'not-found' };
    }
  }
  return window.location.pathname === '/' ? { name: 'home' } : { name: 'not-found' };
}

export function useRoute() {
  const [route, setRoute] = useState(parseLocation);

  useEffect(() => {
    const handlePopState = () => setRoute(parseLocation());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // `state` travels with the history entry, e.g. the display name chosen on the home page.
  const navigate = useCallback((path, { state = null, replace = false } = {}) => {
    window.history[replace ? 'replaceState' : 'pushState'](state, '', path);
    setRoute(parseLocation());
  }, []);

  return { route, navigate, state: window.history.state };
}
