import { useRef } from 'react';
import { Modal } from './ui/Modal.jsx';
import { CopyButton } from './ui/CopyButton.jsx';
import { TextField } from './ui/TextField.jsx';
import { roomUrl } from '../lib/rooms.js';

// Opens when the browser blocks the one-click copy: the link, pre-selected, with a Copy button
// that tries again another way. If that fails too, the selected text can be copied by hand.
export function ShareDialog({ open, roomId, onClose }) {
  const inputRef = useRef(null);
  return (
    <Modal open={open} title="Invite people" onClose={onClose} initialFocusRef={inputRef}>
      <p className="dialog-copy">
        Anyone with this link can join and edit. Your browser blocked copying it automatically, so copy it here.
      </p>
      <TextField
        ref={inputRef}
        label="Invite link"
        value={roomUrl(roomId)}
        mono
        readOnly
        onFocus={(event) => event.target.select()}
        action={
          <CopyButton
            text={roomUrl(roomId)}
            label="Copy"
            variant="primary"
            onCopyFailed={() => inputRef.current?.select()}
          />
        }
      />
      <p className="share-room">
        Room code <code>{roomId}</code>
      </p>
    </Modal>
  );
}
