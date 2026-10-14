const LOCAL_DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d{1,5}$/;

// CLIENT_ORIGIN is a comma-separated list. Outside production any local dev port is also
// accepted, so Vite falling back from 5173 to another port keeps working.
export function createOriginMatcher({ clientOrigin = 'http://localhost:5173', nodeEnv } = {}) {
  const allowedOrigins = new Set(
    clientOrigin.split(',').map((origin) => origin.trim().replace(/\/+$/, '')).filter(Boolean),
  );
  const allowLocalDev = nodeEnv !== 'production';

  return function isAllowedOrigin(origin) {
    if (typeof origin !== 'string') return false;
    return allowedOrigins.has(origin) || (allowLocalDev && LOCAL_DEV_ORIGIN.test(origin));
  };
}
