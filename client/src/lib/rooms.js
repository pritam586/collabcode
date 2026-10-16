// Room ids: 1-64 letters, digits, dots, dashes or underscores, starting with a letter or digit.
// Must match roomIdSchema on the server.
export const ROOM_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

const ADJECTIVES = [
  'amber',
  'bold',
  'brave',
  'bright',
  'calm',
  'clever',
  'cosmic',
  'crisp',
  'eager',
  'fuzzy',
  'gentle',
  'happy',
  'jolly',
  'keen',
  'lucky',
  'mellow',
  'nimble',
  'quick',
  'quiet',
  'rapid',
  'shiny',
  'sunny',
  'swift',
  'witty',
];
const NOUNS = [
  'badger',
  'comet',
  'falcon',
  'fox',
  'gecko',
  'heron',
  'koala',
  'lemur',
  'lynx',
  'maple',
  'nova',
  'otter',
  'panda',
  'pixel',
  'quokka',
  'raven',
  'rocket',
  'sparrow',
  'tiger',
  'walrus',
  'wombat',
  'yak',
  'zebra',
  'orca',
];

function randomInt(max) {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0] % max;
}

// Readable and hard to guess: about 5.7 million combinations, e.g. "swift-otter-4821".
export function generateRoomId() {
  return `${ADJECTIVES[randomInt(ADJECTIVES.length)]}-${NOUNS[randomInt(NOUNS.length)]}-${1000 + randomInt(9000)}`;
}

// Accepts a bare room code or any link containing /r/<code>. Returns the code or null.
export function parseRoomInput(input) {
  const value = input.trim();
  if (!value) return null;
  const fromLink = value.match(/\/r\/([^/?#\s]+)/);
  const candidate = fromLink ? decodeURIComponent(fromLink[1]) : value;
  return ROOM_ID_PATTERN.test(candidate) ? candidate : null;
}

export const looksLikeLink = (value) => /[/:]/.test(value);

// Spaces become dashes as you type ("swift otter 4821" -> "swift-otter-4821"). Nothing else is
// rewritten: codes are case-sensitive and may contain dots and underscores. Links are left
// alone while typing.
export function formatRoomCode(value) {
  return looksLikeLink(value) ? value : value.replace(/^\s+/, '').replace(/\s+/g, '-');
}

export function roomPath(roomId) {
  return `/r/${encodeURIComponent(roomId)}`;
}

export function roomUrl(roomId) {
  return `${window.location.origin}${roomPath(roomId)}`;
}

export function randomGuestName() {
  return `Guest ${1000 + randomInt(9000)}`;
}
