const palette = ['violet', 'cyan', 'amber', 'rose', 'lime', 'sky'];

export function assignColor(room) {
  const colorsInUse = new Set([...room.participants.values()].map((participant) => participant.color));
  return palette.find((color) => !colorsInUse.has(color)) || palette[room.participants.size % palette.length];
}
