// Fixed-window limiter keyed by client address. Expired windows are swept at most once
// per window so the map cannot grow without bound as new addresses appear.
export function createRateLimiter({ windowMs, maxRequests }) {
  const windows = new Map();
  let lastSweepAt = 0;

  function sweep(now) {
    if (now - lastSweepAt < windowMs) return;
    lastSweepAt = now;
    for (const [key, window] of windows) {
      if (now - window.startedAt > windowMs) windows.delete(key);
    }
  }

  return {
    allow(key, now = Date.now()) {
      sweep(now);
      const window = windows.get(key);
      if (!window || now - window.startedAt > windowMs) {
        windows.set(key, { startedAt: now, count: 1 });
        return true;
      }
      if (window.count >= maxRequests) return false;
      window.count += 1;
      return true;
    },
    get size() {
      return windows.size;
    },
  };
}
