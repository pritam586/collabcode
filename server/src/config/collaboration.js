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
export const MAX_DELTA_TEXT_LENGTH = 25_000;
export const MAX_DOCUMENT_LENGTH = 100_000;

export function isSupportedLanguage(language) {
  return typeof language === 'string' && SUPPORTED_LANGUAGES.has(language);
}

export function isValidRoomId(roomId) {
  return typeof roomId === 'string'
    && roomId.length > 0
    && roomId.length <= MAX_ROOM_ID_LENGTH
    && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(roomId);
}

export function isValidDisplayName(name) {
  return typeof name === 'string'
    && name.length > 0
    && name.length <= MAX_DISPLAY_NAME_LENGTH
    && /^[^\u0000-\u001F\u007F]+$/.test(name);
}
