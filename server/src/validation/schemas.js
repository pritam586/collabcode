import { z } from 'zod';
import {
  MAX_DELTA_TEXT_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_ROOM_ID_LENGTH,
  SUPPORTED_LANGUAGES,
} from '../config/collaboration.js';
import { getSupportedRunLanguages, MAX_RUN_CODE_LENGTH } from '../services/codeRunner.js';

// Every schema is a z.object, which drops unknown keys, so handlers only ever see known fields.
const positiveInt = z.number().int().positive();

export const roomIdSchema = z.string().trim().min(1).max(MAX_ROOM_ID_LENGTH).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);

// Rejects control characters and bidirectional overrides (which can make a name render as
// someone else's) and normalises Unicode so visually identical names are stored identically.
export const displayNameSchema = z.string()
  .trim()
  .normalize('NFC')
  .min(1)
  .max(MAX_DISPLAY_NAME_LENGTH)
  .regex(/^[^\u0000-\u001F\u007F‪-‮⁦-⁩]+$/);

export const joinRoomSchema = z.object({ roomId: roomIdSchema, name: displayNameSchema });

export const roomRefSchema = z.object({ roomId: z.string() });

export const rangeSchema = z.object({
  startLineNumber: positiveInt,
  startColumn: positiveInt,
  endLineNumber: positiveInt,
  endColumn: positiveInt,
});

export const deltaSchema = z.object({ range: rangeSchema, text: z.string().max(MAX_DELTA_TEXT_LENGTH) });

// version and delta are checked by the room service so that a stale version or a bad delta
// still gets a resync reply instead of being silently dropped.
export const codeChangeSchema = z.object({ roomId: z.string(), version: z.unknown(), delta: z.unknown() });

export const selectionSchema = rangeSchema.refine(
  (range) => range.startLineNumber < range.endLineNumber
    || (range.startLineNumber === range.endLineNumber && range.startColumn <= range.endColumn),
  'Selection start must come before its end.',
);

export const cursorUpdateSchema = z.object({ roomId: z.string(), position: selectionSchema });

export const languageChangeSchema = z.object({ roomId: z.string(), language: z.enum([...SUPPORTED_LANGUAGES]) });

const codeLengthMessage = `Code must be between 1 and ${MAX_RUN_CODE_LENGTH} characters.`;
export const runRequestSchema = z.object({
  language: z.enum([...getSupportedRunLanguages()], { error: 'Only Java, TypeScript, Python, and C++ are supported by this runner.' }),
  code: z.string({ error: codeLengthMessage }).min(1, codeLengthMessage).max(MAX_RUN_CODE_LENGTH, codeLengthMessage),
});
