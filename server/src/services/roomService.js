import { deltaSchema } from '../validation/schemas.js';
import { assignColor } from '../utils/colorAssigner.js';
import { applyDeltaToString } from '../utils/textDelta.js';

const DEFAULT_LANGUAGE = 'javascript';

// Owns every room's live state. Open rooms (and their participants) live in memory; document
// content and language are written to the repository shortly after each change, when the last
// participant leaves, and on shutdown. Without a repository rooms are memory-only.
export function createRoomService({
  repository = null,
  logger,
  maxParticipants = 10,
  emptyRoomTtlMs = 30 * 60 * 1000,
  retentionMs = 30 * 24 * 60 * 60 * 1000,
  flushIntervalMs = 2000,
  sweepIntervalMs = 60_000,
  now = Date.now,
}) {
  const rooms = new Map();
  const dirtyRoomIds = new Set();
  const timers = [];

  function openRoom(roomId) {
    let room = rooms.get(roomId);
    if (room) return room;

    const stored = repository?.find(roomId);
    const timestamp = now();
    room = {
      id: roomId,
      content: stored?.content ?? '',
      language: stored?.language ?? DEFAULT_LANGUAGE,
      docVersion: stored?.docVersion ?? 0,
      createdAt: stored?.createdAt ?? timestamp,
      updatedAt: stored?.updatedAt ?? timestamp,
      lastActiveAt: timestamp,
      participants: new Map(),
      persisted: Boolean(stored),
    };
    rooms.set(roomId, room);
    return room;
  }

  function markChanged(room) {
    const timestamp = now();
    room.updatedAt = timestamp;
    room.lastActiveAt = timestamp;
    dirtyRoomIds.add(room.id);
  }

  function save(roomIds) {
    if (!repository || roomIds.length === 0) return;
    const toSave = roomIds.map((id) => rooms.get(id)).filter(Boolean);
    try {
      repository.saveMany(toSave);
      for (const room of toSave) {
        room.persisted = true;
        dirtyRoomIds.delete(room.id);
      }
    } catch (error) {
      // Rooms stay dirty, so the next flush retries them.
      logger?.error({ err: error, roomIds }, 'Failed to save rooms');
    }
  }

  const service = {
    getRoom(roomId) {
      return rooms.get(roomId);
    },

    join(roomId, socketId, name) {
      const room = openRoom(roomId);
      if (!room.participants.has(socketId) && room.participants.size >= maxParticipants) {
        return { ok: false, reason: 'full', maxParticipants };
      }

      const participant = { name, color: assignColor(room), cursor: null };
      room.participants.set(socketId, participant);
      room.lastActiveAt = now();
      return { ok: true, room, participant };
    },

    leave(roomId, socketId) {
      const room = rooms.get(roomId);
      if (!room || !room.participants.delete(socketId)) return false;

      room.lastActiveAt = now();
      // Save right away when the room empties so its content and visit time survive eviction.
      if (room.participants.size === 0 && (room.persisted || dirtyRoomIds.has(room.id))) save([room.id]);
      return true;
    },

    // Returns { status: 'accepted', version, delta } or { status: 'stale' | 'invalid' }.
    applyChange(roomId, version, delta) {
      const room = rooms.get(roomId);
      if (!room) return { status: 'invalid' };
      if (version !== room.docVersion) return { status: 'stale' };

      const parsedDelta = deltaSchema.safeParse(delta);
      const updatedContent = parsedDelta.success ? applyDeltaToString(room.content, parsedDelta.data) : null;
      if (updatedContent === null) return { status: 'invalid' };

      room.content = updatedContent;
      room.docVersion += 1;
      markChanged(room);
      return { status: 'accepted', version: room.docVersion, delta: parsedDelta.data };
    },

    setLanguage(roomId, language) {
      const room = rooms.get(roomId);
      if (!room) return false;
      room.language = language;
      markChanged(room);
      return true;
    },

    updateCursor(roomId, socketId, position) {
      const participant = rooms.get(roomId)?.participants.get(socketId);
      if (!participant) return null;
      participant.cursor = position;
      return participant;
    },

    snapshot(room) {
      return {
        content: room.content,
        version: room.docVersion,
        language: room.language,
        participants: [...room.participants.entries()].map(([socketId, participant]) => ({
          socketId,
          ...participant,
        })),
      };
    },

    flush() {
      save([...dirtyRoomIds]);
    },

    // Evicts rooms that have been empty longer than the TTL (saving them first) and deletes
    // stored rooms nobody has opened within the retention period.
    sweep() {
      const timestamp = now();
      service.flush();
      for (const [roomId, room] of rooms) {
        const idle = room.participants.size === 0 && timestamp - room.lastActiveAt > emptyRoomTtlMs;
        if (idle && !dirtyRoomIds.has(roomId)) rooms.delete(roomId);
      }

      if (!repository) return;
      try {
        const deleted = repository.deleteInactive(timestamp - retentionMs, [...rooms.keys()]);
        if (deleted > 0) logger?.info({ deleted }, 'Deleted rooms past their retention period');
      } catch (error) {
        logger?.error({ err: error }, 'Failed to delete expired rooms');
      }
    },

    start() {
      timers.push(setInterval(() => service.flush(), flushIntervalMs).unref());
      timers.push(setInterval(() => service.sweep(), sweepIntervalMs).unref());
      service.sweep();
    },

    close() {
      for (const timer of timers.splice(0)) clearInterval(timer);
      service.flush();
    },

    stats() {
      let participants = 0;
      for (const room of rooms.values()) participants += room.participants.size;
      return { openRooms: rooms.size, participants, unsavedRooms: dirtyRoomIds.size };
    },
  };

  return service;
}
