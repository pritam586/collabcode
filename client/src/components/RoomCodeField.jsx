import { forwardRef } from 'react';
import { CircleCheck } from 'lucide-react';
import { TextField } from './ui/TextField.jsx';
import { formatRoomCode, looksLikeLink, parseRoomInput } from '../lib/rooms.js';

// The room code or invite link field. A pasted invite link is replaced by its room code, and a
// typed link becomes its code when the field loses focus. Once the input names a valid room,
// the hint says so.
export const RoomCodeField = forwardRef(function RoomCodeField({ value, onChange, error, action }, ref) {
  const roomId = parseRoomInput(value);

  function handlePaste(event) {
    const pasted = event.clipboardData?.getData('text') ?? '';
    const code = looksLikeLink(pasted) ? parseRoomInput(pasted) : null;
    if (!code) return;
    event.preventDefault();
    onChange(code);
  }

  return (
    <TextField
      ref={ref}
      label="Room code or invite link"
      placeholder="swift-otter-4821"
      size="lg"
      mono
      value={value}
      autoComplete="off"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      error={error}
      hint={
        roomId ? (
          <span className="field-hint-success">
            <CircleCheck size={14} aria-hidden="true" />
            Ready to join <code>{roomId}</code>
          </span>
        ) : (
          'Paste the invite link someone sent you, or type the room code.'
        )
      }
      onChange={(event) => onChange(formatRoomCode(event.target.value))}
      onPaste={handlePaste}
      onBlur={() => roomId && looksLikeLink(value) && onChange(roomId)}
      action={action}
    />
  );
});
