export const SUPPORTED_LANGUAGES = new Set([
  'javascript',
  'typescript',
  'java',
  'cpp',
  'python',
  'json',
  'css',
  'html',
  'markdown',
]);

export const MAX_ROOM_ID_LENGTH = 64;
export const MAX_DISPLAY_NAME_LENGTH = 32;
export const MAX_DOCUMENT_LENGTH = 100_000;
// Largest single Yjs message accepted from a client. A full 100,000-character document in
// non-Latin script can take ~300 KB, plus edit-history metadata. Socket.io's buffer limit
// (SOCKET_BUFFER_BYTES) sits just above it so the server can reply instead of disconnecting.
export const MAX_YJS_MESSAGE_BYTES = 1_000_000;
export const SOCKET_BUFFER_BYTES = 1_100_000;
// Largest JSON awareness state (cursor and typing flags) accepted per client.
export const MAX_AWARENESS_STATE_LENGTH = 2_000;
export const MAX_CHAT_MESSAGE_LENGTH = 1_000;
