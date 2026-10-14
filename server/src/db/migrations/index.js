import createRooms from './001_create_rooms.js';
import addRoomYdoc from './002_add_room_ydoc.js';
import createChatMessages from './003_create_chat_messages.js';

// Append new migrations here; never edit one that has already shipped.
export const migrations = [createRooms, addRoomYdoc, createChatMessages];
