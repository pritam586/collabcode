export function createMinimalDelta(before, after) {
  if (before === after) return null;

  let prefixLength = 0;
  const sharedLength = Math.min(before.length, after.length);
  while (prefixLength < sharedLength && before[prefixLength] === after[prefixLength]) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < before.length - prefixLength &&
    suffixLength < after.length - prefixLength &&
    before[before.length - suffixLength - 1] === after[after.length - suffixLength - 1]
  ) {
    suffixLength += 1;
  }

  const replacedEnd = before.length - suffixLength;
  return {
    range: {
      ...offsetToPosition(before, prefixLength),
      ...endPosition(before, replacedEnd),
    },
    text: after.slice(prefixLength, after.length - suffixLength),
  };
}

export function applyDeltaToText(content, delta) {
  const start = positionToOffset(content, delta.range.startLineNumber, delta.range.startColumn);
  const end = positionToOffset(content, delta.range.endLineNumber, delta.range.endColumn);
  if (start === null || end === null || start > end) return null;
  return `${content.slice(0, start)}${delta.text}${content.slice(end)}`;
}

function offsetToPosition(content, offset) {
  let lineNumber = 1;
  let lineStart = 0;
  for (let index = 0; index < offset; index += 1) {
    if (content[index] === '\n') {
      lineNumber += 1;
      lineStart = index + 1;
    }
  }
  return { startLineNumber: lineNumber, startColumn: offset - lineStart + 1 };
}

function endPosition(content, offset) {
  const start = offsetToPosition(content, offset);
  return { endLineNumber: start.startLineNumber, endColumn: start.startColumn };
}

function positionToOffset(content, lineNumber, column) {
  const lines = content.split('\n');
  if (lineNumber < 1 || lineNumber > lines.length || column < 1 || column > lines[lineNumber - 1].length + 1) {
    return null;
  }

  let offset = 0;
  for (let index = 0; index < lineNumber - 1; index += 1) offset += lines[index].length + 1;
  return offset + column - 1;
}
