import { useRef } from 'react';
import { Modal } from './ui/Modal.jsx';
import { TextField } from './ui/TextField.jsx';
import { roomUrl } from '../lib/rooms.js';

// Fallback when the browser blocks clipboard access: show the link, pre-selected.
export function ShareDialog({ open, roomId, onClose }) {
  const inputRef = useRef(null);
  return (
    <Modal open={open} title="Invite people" onClose={onClose} initialFocusRef={inputRef}>
      <p className="dialog-copy">
        Your browser did not let CollabCode copy the link. Copy it from here and send it to anyone you want to code
        with.
      </p>
      <TextField
        ref={inputRef}
        label="Invite link"
        value={roomUrl(roomId)}
        readOnly
        onFocus={(event) => event.target.select()}
      />
    </Modal>
  );
}
