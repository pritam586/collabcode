import { z } from 'zod';
import {
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_ROOM_ID_LENGTH,
  MAX_YJS_MESSAGE_BYTES,
  SUPPORTED_LANGUAGES,
} from '../config/collaboration.js';
import { getSupportedRunLanguages, MAX_RUN_CODE_LENGTH } from '../services/codeRunner.js';

// Every schema is a z.object, which drops unknown keys, so handlers only ever see known fields.

export const roomIdSchema = z.string().trim().min(1).max(MAX_ROOM_ID_LENGTH).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);

// Rejects control characters and bidirectional overrides (which can make a name render as
// someone else's) and normalises Unicode so visually identical names are stored identically.
export const displayNameSchema = z.string()
  .trim()
  .normalize('NFC')
  .min(1)
  .max(MAX_DISPLAY_NAME_LENGTH)
  // eslint-disable-next-line no-control-regex -- matching control characters is the point.
  .regex(/^[^\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]+$/);

export const joinRoomSchema = z.object({ roomId: roomIdSchema, name: displayNameSchema });

export const roomRefSchema = z.object({ roomId: z.string() });

// One Yjs sync or awareness message (y-protocols encoding). Socket.io delivers binary as a
// Buffer on the server, which is a Uint8Array.
export const yjsMessageSchema = z.object({
  roomId: z.string(),
  data: z.instanceof(Uint8Array).refine((data) => data.byteLength > 0 && data.byteLength <= MAX_YJS_MESSAGE_BYTES),
});

// A Yjs RelativePosition in its JSON form (Y.relativePositionToJSON).
const yjsId = z.object({ client: z.number().int().nonnegative(), clock: z.number().int().nonnegative() });
const relativePositionSchema = z.object({
  type: yjsId.nullable().optional(),
  tname: z.string().max(64).nullable().optional(),
  item: yjsId.nullable().optional(),
  assoc: z.number().int().optional(),
});

// The parts of a client's awareness state the server accepts. The 'user' field is always
// replaced by the server's own record of the participant.
export const awarenessStateSchema = z.object({
  cursor: z.object({ anchor: relativePositionSchema, head: relativePositionSchema }).nullable().optional(),
  typing: z.boolean().optional(),
});

export const CHAT_MESSAGE_ERROR = `Messages must be 1 to ${MAX_CHAT_MESSAGE_LENGTH.toLocaleString('en-US')} characters.`;

// Line breaks and tabs are allowed in chat; other control characters and bidi overrides are not.
export const chatSendSchema = z.object({
  roomId: z.string(),
  body: z.string()
    .trim()
    .normalize('NFC')
    .min(1, CHAT_MESSAGE_ERROR)
    .max(MAX_CHAT_MESSAGE_LENGTH, CHAT_MESSAGE_ERROR)
    // eslint-disable-next-line no-control-regex -- matching control characters is the point.
    .refine((body) => !/[\x00-\x08\x0B-\x1F\x7F\u202A-\u202E\u2066-\u2069]/.test(body), 'Messages cannot contain control characters.'),
  // Lets the sender match the broadcast copy to the message it is showing as "sending".
  clientId: z.string().max(64).optional(),
});

export const languageChangeSchema = z.object({ roomId: z.string(), language: z.enum([...SUPPORTED_LANGUAGES]) });

const codeLengthMessage = `Code must be between 1 and ${MAX_RUN_CODE_LENGTH} characters.`;
export const runRequestSchema = z.object({
  language: z.enum([...getSupportedRunLanguages()], { error: 'Only Java, TypeScript, Python, and C++ are supported by this runner.' }),
  code: z.string({ error: codeLengthMessage }).min(1, codeLengthMessage).max(MAX_RUN_CODE_LENGTH, codeLengthMessage),
});
