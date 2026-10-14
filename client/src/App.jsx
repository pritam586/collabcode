import { useEffect, useRef, useState } from 'react';
import { EditorPane } from './components/EditorPane.jsx';
import { LanguageSelector } from './components/LanguageSelector.jsx';
import { ParticipantsList } from './components/ParticipantsList.jsx';
import { RoomJoinModal } from './components/RoomJoinModal.jsx';
import { getFileExtension } from './constants/languages.js';
import { socket } from './socket.js';

const savedName = window.localStorage.getItem('collabcode-name') || `Guest ${Math.floor(100 + Math.random() * 900)}`;

export default function App() {
  const [connectionState, setConnectionState] = useState(socket.connected ? 'connected' : 'connecting');
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [remoteCursors, setRemoteCursors] = useState({});
  const [notice, setNotice] = useState('');
  const [joinError, setJoinError] = useState('');
  const [recoveryDraft, setRecoveryDraft] = useState('');
  const [syncKey, setSyncKey] = useState(0);
  const [runRequest, setRunRequest] = useState(0);
  const [isOutputOpen, setIsOutputOpen] = useState(false);
  const requestedRoomRef = useRef(null);
  const roomRef = useRef(null);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    if (!room) return undefined;
    // Ctrl/Cmd+Enter runs code from anywhere in the workspace; Monaco handles it itself when focused.
    function handleKeyDown(event) {
      if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey) || event.defaultPrevented) return;
      event.preventDefault();
      setRunRequest((value) => value + 1);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [room]);

  useEffect(() => {
    function joinRequestedRoom() {
      if (requestedRoomRef.current) socket.emit('join-room', requestedRoomRef.current);
    }

    function handleConnect() {
      setConnectionState('connected');
      joinRequestedRoom();
    }

    function handleDisconnect() {
      setConnectionState('disconnected');
    }

    function handleRoomSync(snapshot) {
      const previous = roomRef.current;
      // Rejoining and finding an older version than ours means the server lost recent changes;
      // keep our language so EditorPane can restore the code under the right mode.
      const serverLostRoom = previous?.id === snapshot.roomId && previous.version > snapshot.version;
      const language = serverLostRoom ? previous.language : snapshot.language;
      if (serverLostRoom && language !== snapshot.language) socket.emit('language-change', { roomId: snapshot.roomId, language });

      setRoom((current) => ({
        id: snapshot.roomId,
        name: requestedRoomRef.current?.name || current?.name || savedName,
        content: snapshot.content,
        version: snapshot.version,
        language,
      }));
      setParticipants(snapshot.participants);
      setRemoteCursors({});
      setSyncKey((value) => value + 1);
      setJoinError('');
    }

    function handleParticipantJoined(participant) {
      setParticipants((current) => [...current.filter((item) => item.socketId !== participant.socketId), participant]);
    }

    function handleParticipantLeft({ socketId }) {
      setParticipants((current) => current.filter((participant) => participant.socketId !== socketId));
      setRemoteCursors((current) => {
        const next = { ...current };
        delete next[socketId];
        return next;
      });
    }

    function handleRemoteCursor(cursor) {
      if (cursor.socketId === socket.id) return;
      setRemoteCursors((current) => ({ ...current, [cursor.socketId]: cursor }));
    }

    function handleLanguageChanged({ language }) {
      setRoom((current) => current ? { ...current, language } : current);
    }

    function handleRoomError({ message }) {
      // In the workspace this means an automatic rejoin failed (for example, the room filled up).
      if (roomRef.current) setNotice(`${message} You are no longer receiving live updates.`);
      else setJoinError(message);
    }

    function handleServerError({ message }) {
      setNotice(message);
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('room-sync', handleRoomSync);
    socket.on('participant-joined', handleParticipantJoined);
    socket.on('participant-left', handleParticipantLeft);
    socket.on('remote-cursor', handleRemoteCursor);
    socket.on('language-changed', handleLanguageChanged);
    socket.on('room-error', handleRoomError);
    socket.on('server-error', handleServerError);
    socket.connect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('room-sync', handleRoomSync);
      socket.off('participant-joined', handleParticipantJoined);
      socket.off('participant-left', handleParticipantLeft);
      socket.off('remote-cursor', handleRemoteCursor);
      socket.off('language-changed', handleLanguageChanged);
      socket.off('room-error', handleRoomError);
      socket.off('server-error', handleServerError);
      socket.disconnect();
    };
  }, []);

  function joinRoom({ roomId, name }) {
    if (!roomId || !name) return;
    window.localStorage.setItem('collabcode-name', name);
    requestedRoomRef.current = { roomId, name };
    setJoinError('');
    if (socket.connected) socket.emit('join-room', requestedRoomRef.current);
    else socket.connect();
  }

  function leaveRoom() {
    socket.emit('leave-room');
    requestedRoomRef.current = null;
    setRoom(null);
    setParticipants([]);
    setRemoteCursors({});
    setNotice('');
    setJoinError('');
    setRecoveryDraft('');
  }

  function changeLanguage(language) {
    if (!room) return;
    setRoom((current) => ({ ...current, language }));
    socket.emit('language-change', { roomId: room.id, language });
  }

  async function copyRecoveryDraft() {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard access is unavailable.');
      await navigator.clipboard.writeText(recoveryDraft);
      setNotice('Unsynced draft copied to your clipboard.');
    } catch {
      setNotice('Copy failed. Select the draft text and copy it manually.');
    }
  }

  if (!room) {
    return <RoomJoinModal defaultName={savedName} onJoin={joinRoom} connectionState={connectionState} errorMessage={joinError} />;
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <button className="wordmark" type="button" onClick={leaveRoom} title="Leave workspace" aria-label="CollabCode, leave workspace">&lt;/&gt; <span>collab<span>code</span></span></button>
        <div className="room-crumb"><span className={`connection-indicator ${connectionState}`}><i /> {connectionState === 'connected' ? 'Live' : 'Reconnecting'}</span><span className="slash">/</span><span>{room.id}</span></div>
        <div className="header-actions">
          <span className="version-label">v{room.version}</span>
          <LanguageSelector language={room.language} onChange={changeLanguage} />
          <button className="run-button" type="button" title="Run code (Ctrl+Enter)" aria-keyshortcuts="Control+Enter Meta+Enter" onClick={() => setRunRequest((value) => value + 1)}>
            <span aria-hidden="true">&#9654;</span> Run code
          </button>
          <button className={`output-toggle ${isOutputOpen ? 'active' : ''}`} type="button" aria-pressed={isOutputOpen} onClick={() => setIsOutputOpen((isOpen) => !isOpen)}>
            <span aria-hidden="true">&#9646;</span> Output
          </button>
          <button className="leave-button" type="button" onClick={leaveRoom}>Leave</button>
        </div>
      </header>

      {notice && <div className="notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notice">&times;</button></div>}
      {recoveryDraft && (
        <section className="recovery-draft" aria-label="Recovered local draft">
          <div><strong>Unsynced draft preserved.</strong><span>A concurrent update arrived before your edits could be synced. Copy this draft before continuing.</span></div>
          <textarea readOnly value={recoveryDraft} aria-label="Unsynced local draft" />
          <div className="recovery-actions"><button type="button" onClick={copyRecoveryDraft}>Copy draft</button><button type="button" onClick={() => setRecoveryDraft('')}>Dismiss</button></div>
        </section>
      )}

      <section className="workspace-main">
        <div className="editor-column">
          <div className="file-tab"><span className="file-dot" /> untitled.{getFileExtension(room.language)}</div>
          <EditorPane
            key={room.id}
            room={room}
            syncKey={syncKey}
            runRequest={runRequest}
            isOutputOpen={isOutputOpen}
            remoteCursors={remoteCursors}
            onVersionChange={(version) => setRoom((current) => current ? { ...current, version } : current)}
            onLanguageResync={(language) => setRoom((current) => current && language ? { ...current, language } : current)}
            onRecoveryDraft={(draft) => setRecoveryDraft((current) => current || draft)}
            onOutputVisibilityChange={setIsOutputOpen}
            onNotice={setNotice}
            onRunShortcut={() => setRunRequest((value) => value + 1)}
          />
          <footer className="editor-status"><span><i className={`status-dot ${connectionState}`} /> {connectionState === 'connected' ? 'Synced' : 'Offline changes protected'}</span><span>UTF-8</span><span>Spaces: 2</span><span>{room.language}</span></footer>
        </div>
        <ParticipantsList participants={participants} selfSocketId={socket.id} />
      </section>
    </main>
  );
}
