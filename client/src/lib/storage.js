// localStorage can throw (private mode, blocked storage), so every access is guarded and the
// app keeps working without saved preferences.
export function readStorage(key, fallback) {
  let value;
  try {
    value = window.localStorage.getItem(key);
  } catch {
    return fallback;
  }
  if (value === null) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    // Older versions stored plain strings (for example the display name).
    return value;
  }
}

export function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not saved; the in-memory value still applies for this visit.
  }
}

// crypto.randomUUID only exists on secure origins (https or localhost).
export function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
