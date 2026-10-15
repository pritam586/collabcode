// Where the API and Socket.io server live, from VITE_SERVER_URL at build time:
// - unset: http://localhost:4000 (local development),
// - "same-origin": the page's own origin, for deployments where a reverse proxy serves the
//   app and forwards /api and /socket.io to the server (see client/nginx.conf.template),
// - any other value: used as-is, e.g. https://api.collab.example.com.
const configured = import.meta.env.VITE_SERVER_URL;

export const SERVER_URL = !configured
  ? 'http://localhost:4000'
  : configured === 'same-origin'
    ? window.location.origin
    : configured.replace(/\/+$/, '');
