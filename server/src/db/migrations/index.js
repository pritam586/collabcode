import createRooms from './001_create_rooms.js';
import addRoomYdoc from './002_add_room_ydoc.js';

// Append new migrations here; never edit one that has already shipped.
export const migrations = [createRooms, addRoomYdoc];
