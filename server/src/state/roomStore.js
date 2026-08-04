const rooms = new Map();

export function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      docVersion: 0,
      content: '',
      language: 'javascript',
      participants: new Map(),
    });
  }

  return rooms.get(roomId);
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
  return `${content.slice(0, start)}${delta.text}${content.slice(end)}`;
}

function isValidDelta(delta) {
  const { range, text } = delta || {};
  if (typeof text !== 'string' || !range || typeof range !== 'object') return false;

  return [
    range.startLineNumber,
    range.startColumn,
    range.endLineNumber,
    range.endColumn,
  ].every((value) => Number.isInteger(value) && value > 0);
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
