// Stores each room as a Yjs document (Y.encodeStateAsUpdate). `content` is kept as a
// plain-text copy for inspection and for rooms saved before this migration, which are
// converted to Yjs the first time they are opened.
export default {
  version: 2,
  name: 'add_room_ydoc',
  up: 'ALTER TABLE rooms ADD COLUMN ydoc BLOB;',
};
