import { MAX_DELTA_TEXT_LENGTH, MAX_DOCUMENT_LENGTH } from '../config/collaboration.js';

const rooms = new Map();
const EMPTY_ROOM_TTL_MS = 30 * 60 * 1000;

export function getOrCreateRoom(roomId) {
  pruneExpiredRooms();
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      docVersion: 0,
      content: '',
      language: 'javascript',
      participants: new Map(),
      lastActivityAt: Date.now(),
    });
  }

  const room = rooms.get(roomId);
  touchRoom(room);
  return room;
}

export function getRoomSnapshot(room) {
  return {
    content: room.content,
    version: room.docVersion,
    language: room.language,
    participants: [...room.participants.entries()].map(([socketId, participant]) => ({
      socketId,
      ...participant,
    })),
  };
}

export function applyDeltaToString(content, delta) {
  if (!isValidDelta(delta)) return null;

  const start = positionToOffset(content, delta.range.startLineNumber, delta.range.startColumn);
  const end = positionToOffset(content, delta.range.endLineNumber, delta.range.endColumn);

  if (start === null || end === null || start > end) return null;
  const updatedContent = `${content.slice(0, start)}${delta.text}${content.slice(end)}`;
  return updatedContent.length <= MAX_DOCUMENT_LENGTH ? updatedContent : null;
}

export function touchRoom(room) {
  room.lastActivityAt = Date.now();
}

export function markRoomEmpty(room) {
  room.lastActivityAt = Date.now();
}

function isValidDelta(delta) {
  const { range, text } = delta || {};
  if (typeof text !== 'string' || text.length > MAX_DELTA_TEXT_LENGTH || !range || typeof range !== 'object') return false;

  return [
    range.startLineNumber,
    range.startColumn,
    range.endLineNumber,
    range.endColumn,
  ].every((value) => Number.isInteger(value) && value > 0);
}

function pruneExpiredRooms(now = Date.now()) {
  for (const [roomId, room] of rooms) {
    if (room.participants.size === 0 && now - room.lastActivityAt > EMPTY_ROOM_TTL_MS) rooms.delete(roomId);
  }
}

function positionToOffset(content, lineNumber, column) {
  const lines = content.split('\n');
  if (lineNumber > lines.length || column > lines[lineNumber - 1].length + 1) return null;

  let offset = 0;
  for (let index = 0; index < lineNumber - 1; index += 1) {
    offset += lines[index].length + 1;
  }

  return offset + column - 1;
}
