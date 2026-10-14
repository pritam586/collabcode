import { MAX_DOCUMENT_LENGTH } from '../config/collaboration.js';
import { deltaSchema } from '../validation/schemas.js';

// Applies a Monaco-style { range, text } replacement. Returns null when the delta is malformed,
// points outside the document, or would make the document too large.
export function applyDeltaToString(content, delta) {
  const parsed = deltaSchema.safeParse(delta);
  if (!parsed.success) return null;
  const { range, text } = parsed.data;

  const start = positionToOffset(content, range.startLineNumber, range.startColumn);
  const end = positionToOffset(content, range.endLineNumber, range.endColumn);

  if (start === null || end === null || start > end) return null;
  const updatedContent = `${content.slice(0, start)}${text}${content.slice(end)}`;
  return updatedContent.length <= MAX_DOCUMENT_LENGTH ? updatedContent : null;
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
