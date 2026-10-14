import { useRef, useState } from 'react';
import { Button } from './ui/Button.jsx';
import { Modal } from './ui/Modal.jsx';
import { TextField } from './ui/TextField.jsx';
import { randomGuestName } from '../lib/rooms.js';
import { readSavedName, saveName } from '../hooks/usePreferences.js';

// Shown when someone opens an invite link: they only need a display name.
export function JoinDialog({ roomId, onJoin, onCancel }) {
  const [name, setName] = useState(() => readSavedName() || randomGuestName());
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  function submit(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a name so others know who you are.');
      return;
    }
    saveName(trimmed);
    onJoin(trimmed);
  }

  return (
    <Modal open title="Join this room" dismissible={false} initialFocusRef={inputRef}>
      <form className="dialog-form" onSubmit={submit} noValidate>
        <p className="dialog-copy">You are joining <strong className="room-code">{roomId}</strong>. Pick the name others will see; no account needed.</p>
        <TextField
          ref={inputRef}
          label="Your name"
          value={name}
          maxLength={32}
          autoComplete="nickname"
          error={error}
          onChange={(event) => { setName(event.target.value); setError(''); }}
        />
        <div className="modal-actions">
          <Button variant="ghost" onClick={onCancel}>Back to home</Button>
          <Button type="submit" variant="primary">Join room</Button>
        </div>
      </form>
    </Modal>
  );
}
