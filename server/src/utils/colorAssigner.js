const palette = ['violet', 'cyan', 'amber', 'rose', 'lime', 'sky'];

export function assignColor(room) {
  return palette[room.participants.size % palette.length];
}
