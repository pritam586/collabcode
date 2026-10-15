import { EventEmitter } from 'node:events';
import { applyAwarenessUpdate, Awareness, removeAwarenessStates } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { MAX_DOCUMENT_LENGTH } from '../config/collaboration.js';
import { assignColor } from '../utils/colorAssigner.js';
import { filterAwarenessUpdate } from './awarenessFilter.js';

const DEFAULT_LANGUAGE = 'javascript';
const CHAT_HISTORY_LENGTH = 50;
const CHAT_MESSAGES_KEPT = 500;
export const TEXT_NAME = 'content';
// Transaction origins that are not a client socket. Updates with these origins are not broadcast.
const STORAGE_ORIGIN = 'storage';
export const SERVER_ORIGIN = 'server';

// Owns every room's live state. Each open room holds a Yjs document (the shared text) and a
// Yjs awareness instance (cursors, typing). Documents are written to the repository shortly
// after each change, when the last participant leaves, and on shutdown. Without a repository
// rooms are memory-only.
//
// Events (subscribe with service.on):
//   'document-update'  (room, update, origin)   a Yjs update was applied to room.doc
//   'awareness-update' (room, clientIds, origin) awareness states changed
// `origin` is the socket id that caused the change, or SERVER_ORIGIN.
export function createRoomService({
  repository = null,
  chatRepository = null,
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
  const events = new EventEmitter();

  function openRoom(roomId) {
    let room = rooms.get(roomId);
    if (room) return room;

    const stored = repository?.find(roomId);
    const timestamp = now();
    const doc = new Y.Doc();
    const text = doc.getText(TEXT_NAME);
    if (stored?.ydoc) {
      Y.applyUpdate(doc, stored.ydoc, STORAGE_ORIGIN);
      if (removeCarriageReturns(doc, text)) dirtyRoomIds.add(roomId);
    } else if (stored?.content) {
      // Saved before rooms were stored as Yjs documents; convert on first open.
      doc.transact(() => text.insert(0, stored.content.replace(/\r\n?/g, '\n')), STORAGE_ORIGIN);
      dirtyRoomIds.add(roomId);
    }

    const awareness = new Awareness(doc);
    // The server is not a participant, so it publishes no awareness state of its own.
    awareness.setLocalState(null);

    room = {
      id: roomId,
      doc,
      text,
      awareness,
      // Awareness client id -> socket id, so a socket can only change its own cursor.
      awarenessOwners: new Map(),
      language: stored?.language ?? DEFAULT_LANGUAGE,
      // Counts applied updates; shown to clients as a change counter.
      docVersion: stored?.docVersion ?? 0,
      createdAt: stored?.createdAt ?? timestamp,
      updatedAt: stored?.updatedAt ?? timestamp,
      lastActiveAt: timestamp,
      participants: new Map(),
      persisted: Boolean(stored),
      // The latest chat messages, oldest first, sent to people as they join.
      messages: stored && chatRepository ? chatRepository.recent(roomId, CHAT_HISTORY_LENGTH) : [],
    };

    doc.on('update', (update, origin) => {
      if (origin === STORAGE_ORIGIN) return;
      room.docVersion += 1;
      markChanged(room);
      events.emit('document-update', room, update, origin);
    });
    awareness.on('update', ({ added, updated, removed }, origin) => {
      events.emit('awareness-update', room, [...added, ...updated, ...removed], origin);
    });

    rooms.set(roomId, room);
    return room;
  }

  function closeRoom(room) {
    room.awareness.destroy();
    room.doc.destroy();
    rooms.delete(room.id);
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
      repository.saveMany(
        toSave.map((room) => ({
          id: room.id,
          content: room.text.toString(),
          ydoc: Y.encodeStateAsUpdate(room.doc),
          language: room.language,
          docVersion: room.docVersion,
          createdAt: room.createdAt,
          updatedAt: room.updatedAt,
          lastActiveAt: room.lastActiveAt,
        })),
      );
      for (const room of toSave) {
        room.persisted = true;
        dirtyRoomIds.delete(room.id);
      }
    } catch (error) {
      // Rooms stay dirty, so the next flush retries them.
      logger?.error({ err: error, roomIds }, 'Failed to save rooms');
    }
  }

  // A Yjs update cannot be undone once applied, so updates that might break a rule are tried
  // on a copy first. Inserted characters can never outnumber the update's bytes, and an update
  // without a 0x0D byte cannot insert "\r", so most updates skip the trial.
  // Returns 'ok', 'too-large' or 'invalid'.
  function checkUpdate(room, update) {
    const mayAddCarriageReturn = update.includes(0x0d);
    if (!mayAddCarriageReturn && room.text.length + update.byteLength <= MAX_DOCUMENT_LENGTH) return 'ok';

    const trial = new Y.Doc();
    try {
      Y.applyUpdate(trial, Y.encodeStateAsUpdate(room.doc));
      Y.applyUpdate(trial, update);
      const trialText = trial.getText(TEXT_NAME).toString();
      if (trialText.length > MAX_DOCUMENT_LENGTH) return 'too-large';
      // Editors count each line break as one character; a "\r" would shift every offset after it.
      return trialText.includes('\r') ? 'invalid' : 'ok';
    } finally {
      trial.destroy();
    }
  }

  const service = {
    on: (event, listener) => events.on(event, listener),

    getRoom(roomId) {
      return rooms.get(roomId);
    },

    join(roomId, socketId, name) {
      const room = openRoom(roomId);
      if (!room.participants.has(socketId) && room.participants.size >= maxParticipants) {
        return { ok: false, reason: 'full', maxParticipants };
      }

      const participant = { name, color: assignColor(room) };
      room.participants.set(socketId, participant);
      room.lastActiveAt = now();
      return { ok: true, room, participant };
    },

    leave(roomId, socketId) {
      const room = rooms.get(roomId);
      if (!room || !room.participants.delete(socketId)) return false;

      const ownedClientIds = [...room.awarenessOwners]
        .filter(([, owner]) => owner === socketId)
        .map(([clientId]) => clientId);
      for (const clientId of ownedClientIds) room.awarenessOwners.delete(clientId);
      if (ownedClientIds.length > 0) removeAwarenessStates(room.awareness, ownedClientIds, SERVER_ORIGIN);

      room.lastActiveAt = now();
      // Save right away when the room empties so its content and visit time survive eviction.
      if (room.participants.size === 0 && (room.persisted || dirtyRoomIds.has(room.id))) save([room.id]);
      return true;
    },

    // Applies a Yjs update from a client. Returns { status: 'accepted' | 'too-large' | 'invalid' }.
    applyUpdate(roomId, update, origin) {
      const room = rooms.get(roomId);
      if (!room) return { status: 'invalid' };
      try {
        const check = checkUpdate(room, update);
        if (check !== 'ok') return { status: check };
        Y.applyUpdate(room.doc, update, origin);
        return { status: 'accepted' };
      } catch (error) {
        logger?.warn({ err: error, roomId }, 'Rejected malformed Yjs update');
        return { status: 'invalid' };
      }
    },

    // Applies a client's awareness update after binding it to the sender's identity.
    applyAwareness(roomId, socketId, update) {
      const room = rooms.get(roomId);
      const participant = room?.participants.get(socketId);
      if (!participant) return false;

      let filtered;
      try {
        filtered = filterAwarenessUpdate(update, {
          socketId,
          user: { socketId, name: participant.name, color: participant.color },
          owners: room.awarenessOwners,
        });
      } catch {
        return false;
      }
      if (!filtered) return false;
      applyAwarenessUpdate(room.awareness, filtered, socketId);
      return true;
    },

    // Stores a chat message from a participant. The author's name and color come from the
    // server's record, never from the client. Returns the message, or null.
    postMessage(roomId, socketId, body) {
      const room = rooms.get(roomId);
      const participant = room?.participants.get(socketId);
      if (!participant) return null;

      const message = {
        id: 0,
        author: { name: participant.name, color: participant.color, socketId },
        body,
        createdAt: now(),
      };

      markChanged(room);
      if (repository && chatRepository) {
        // The message references the room row, so make sure it exists first.
        save([room.id]);
        if (!room.persisted) return null;
        try {
          message.id = chatRepository.add({
            roomId,
            authorName: participant.name,
            authorColor: participant.color,
            body,
            createdAt: message.createdAt,
          });
          if (message.id % 50 === 0) chatRepository.trim(roomId, CHAT_MESSAGES_KEPT);
        } catch (error) {
          logger?.error({ err: error, roomId }, 'Failed to save chat message');
          return null;
        }
      } else {
        message.id = (room.messages.at(-1)?.id ?? 0) + 1;
      }

      room.messages = [...room.messages, message].slice(-CHAT_HISTORY_LENGTH);
      return message;
    },

    setLanguage(roomId, language) {
      const room = rooms.get(roomId);
      if (!room) return false;
      room.language = language;
      markChanged(room);
      return true;
    },

    snapshot(room) {
      return {
        version: room.docVersion,
        language: room.language,
        participants: [...room.participants.entries()].map(([socketId, participant]) => ({
          socketId,
          ...participant,
        })),
        messages: room.messages,
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
      for (const room of [...rooms.values()]) {
        const idle = room.participants.size === 0 && timestamp - room.lastActiveAt > emptyRoomTtlMs;
        if (idle && !dirtyRoomIds.has(room.id)) closeRoom(room);
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
      for (const room of [...rooms.values()]) closeRoom(room);
    },

    stats() {
      let participants = 0;
      for (const room of rooms.values()) participants += room.participants.size;
      return { openRooms: rooms.size, participants, unsavedRooms: dirtyRoomIds.size };
    },
  };

  return service;
}

// Rewrites "\r\n" and lone "\r" in stored text as "\n" (rooms saved by Windows clients before
// line endings were normalized). Returns true if anything changed.
function removeCarriageReturns(doc, text) {
  const value = text.toString();
  if (!value.includes('\r')) return false;
  doc.transact(() => {
    for (let index = value.length - 1; index >= 0; index -= 1) {
      if (value[index] !== '\r') continue;
      text.delete(index, 1);
      if (value[index + 1] !== '\n') text.insert(index, '\n');
    }
  }, STORAGE_ORIGIN);
  return true;
}
