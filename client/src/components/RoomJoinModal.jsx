import { useState } from 'react';

export function RoomJoinModal({ defaultName, onJoin, connectionState, errorMessage }) {
  const [roomId, setRoomId] = useState('pair-programming');
  const [name, setName] = useState(defaultName);

  function submit(event) {
    event.preventDefault();
    onJoin({ roomId: roomId.trim(), name: name.trim() });
  }

  return (
    <main className="join-shell">
      <section className="join-card" aria-labelledby="join-title">
        <div className="brand-mark" aria-hidden="true">&lt;/&gt;</div>
        <p className="eyebrow">REAL-TIME WORKSPACE</p>
        <h1 id="join-title">Write together.<br /><em>Stay in flow.</em></h1>
        <p className="join-copy">A lightweight shared code room with live cursors, language-aware editing, and zero setup for your collaborators.</p>

        <form onSubmit={submit}>
          <label htmlFor="display-name">Display name</label>
          <input id="display-name" value={name} maxLength="32" onChange={(event) => setName(event.target.value)} placeholder="Ada Lovelace" required />

          <label htmlFor="room-id">Room name</label>
          <input id="room-id" value={roomId} maxLength="64" pattern="[A-Za-z0-9][A-Za-z0-9._-]*" onChange={(event) => setRoomId(event.target.value)} placeholder="frontend-review" required />

          {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}

          <button type="submit" className="primary-button" disabled={connectionState === 'connecting'}>
            {connectionState === 'connecting' ? 'Connecting...' : 'Join workspace'}
            <span aria-hidden="true">&rarr;</span>
          </button>
        </form>

        <p className="join-hint"><span className={`status-dot ${connectionState}`} /> {connectionState === 'connected' ? 'Server ready' : 'Connecting to collaboration server'}</p>
      </section>
    </main>
  );
}
