import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { MAX_AWARENESS_STATE_LENGTH } from '../config/collaboration.js';
import { awarenessStateSchema } from '../validation/schemas.js';

// Awareness updates come from clients, so they cannot be trusted to say who they are.
// This rewrites one update (y-protocols awareness encoding) so that:
//  - a socket can only change the awareness client ids it introduced first,
//  - every state carries the server's record of the user (name, color, socket id),
//  - only the known fields (cursor, typing) survive, and oversized states are dropped.
// Returns the re-encoded update, or null when nothing in it is acceptable.
export function filterAwarenessUpdate(update, { socketId, user, owners }) {
  const decoder = decoding.createDecoder(update);
  const entries = [];
  const count = decoding.readVarUint(decoder);

  for (let index = 0; index < count; index += 1) {
    const clientId = decoding.readVarUint(decoder);
    const clock = decoding.readVarUint(decoder);
    const rawState = decoding.readVarString(decoder);

    const owner = owners.get(clientId);
    if (owner && owner !== socketId) continue;
    if (rawState.length > MAX_AWARENESS_STATE_LENGTH) continue;

    const state = parseState(rawState);
    if (state === undefined) continue;

    owners.set(clientId, socketId);
    entries.push({ clientId, clock, state: state === null ? null : { ...state, user } });
  }

  if (entries.length === 0) return null;
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, entries.length);
  for (const { clientId, clock, state } of entries) {
    encoding.writeVarUint(encoder, clientId);
    encoding.writeVarUint(encoder, clock);
    encoding.writeVarString(encoder, JSON.stringify(state));
  }
  return encoding.toUint8Array(encoder);
}

// null means "this client went offline", which is always allowed. undefined means invalid.
function parseState(rawState) {
  let value;
  try {
    value = JSON.parse(rawState);
  } catch {
    return undefined;
  }
  if (value === null) return null;
  const result = awarenessStateSchema.safeParse(value);
  return result.success ? result.data : undefined;
}
