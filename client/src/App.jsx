import { useEffect, useRef, useState } from 'react';
import { EditorPane } from './components/EditorPane.jsx';
import { LanguageSelector } from './components/LanguageSelector.jsx';
import { ParticipantsList } from './components/ParticipantsList.jsx';
import { RoomJoinModal } from './components/RoomJoinModal.jsx';
import { SocketYjsProvider } from './collab/SocketYjsProvider.js';
import { getFileExtension } from './constants/languages.js';
import { socket } from './socket.js';

const TOO_LARGE_MESSAGE = 'That change is too large to share (the limit is 100,000 characters), so your editor was reset to the shared version.';
const savedName = window.localStorage.getItem('collabcode-name') || `Guest ${Math.floor(100 + Math.random() * 900)}`;

export default function App() {
  const [connectionState, setConnectionState] = useState(socket.connected ? 'connected' : 'connecting');
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [notice, setNotice] = useState('');
  const [joinError, setJoinError] = useState('');
  const [provider, setProvider] = useState(null);
  const [runRequest, setRunRequest] = useState(0);
  const [isOutputOpen, setIsOutputOpen] = useState(false);
  const requestedRoomRef = useRef(null);
  const roomRef = useRef(null);
  const providerRef = useRef(null);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  // The provider (the room's shared Yjs document) lives here rather than in EditorPane so its
  // socket listeners exist before the server's first sync message arrives after room-sync.
  function replaceProvider(roomId) {
    providerRef.current?.destroy();
    const next = roomId ? new SocketYjsProvider(socket, roomId) : null;
    providerRef.current = next;
    setProvider(next);
    return next;
  }

  // Throws away the local copy and loads the shared document again.
  function resetProvider() {
    const roomId = providerRef.current?.roomId;
    if (roomId) replaceProvider(roomId).start();
  }

  useEffect(() => {
    if (!provider) return undefined;
    return provider.on('too-large', () => {
      setNotice(TOO_LARGE_MESSAGE);
      resetProvider();
    });
  }, [provider]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => providerRef.current?.destroy(), []);

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
      let current = providerRef.current;
      if (current?.roomId !== snapshot.roomId) current = replaceProvider(snapshot.roomId);

      // The server has never seen this room but we still hold its code, so it lost the room
      // (for example, it expired). Yjs restores the code; keep our language as well.
      const serverLostRoom = previous?.id === snapshot.roomId && snapshot.version === 0 && current.text.length > 0;
      const language = serverLostRoom ? previous.language : snapshot.language;
      if (serverLostRoom && language !== snapshot.language) socket.emit('language-change', { roomId: snapshot.roomId, language });

      setRoom((current) => ({
        id: snapshot.roomId,
        name: requestedRoomRef.current?.name || current?.name || savedName,
        language,
      }));
      setParticipants(snapshot.participants);
      setJoinError('');
      current.start();
    }

    function handleParticipantJoined(participant) {
      setParticipants((current) => [...current.filter((item) => item.socketId !== participant.socketId), participant]);
    }

    function handleParticipantLeft({ socketId }) {
      setParticipants((current) => current.filter((participant) => participant.socketId !== socketId));
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

    function handleDocumentError({ message, reset }) {
      setNotice(message);
      if (reset) resetProvider();
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('room-sync', handleRoomSync);
    socket.on('participant-joined', handleParticipantJoined);
    socket.on('participant-left', handleParticipantLeft);
    socket.on('language-changed', handleLanguageChanged);
    socket.on('room-error', handleRoomError);
    socket.on('server-error', handleServerError);
    socket.on('document-error', handleDocumentError);
    socket.connect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('room-sync', handleRoomSync);
      socket.off('participant-joined', handleParticipantJoined);
      socket.off('participant-left', handleParticipantLeft);
      socket.off('language-changed', handleLanguageChanged);
      socket.off('room-error', handleRoomError);
      socket.off('server-error', handleServerError);
      socket.off('document-error', handleDocumentError);
      socket.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function joinRoom({ roomId, name }) {
    if (!roomId || !name) return;
    window.localStorage.setItem('collabcode-name', name);
    requestedRoomRef.current = { roomId, name };
    setJoinError('');
    if (socket.connected) socket.emit('join-room', requestedRoomRef.current);
    else socket.connect();
  }

  function leaveRoom() {
    replaceProvider(null);
    socket.emit('leave-room');
    requestedRoomRef.current = null;
    setRoom(null);
    setParticipants([]);
    setNotice('');
    setJoinError('');
  }

  function changeLanguage(language) {
    if (!room) return;
    setRoom((current) => ({ ...current, language }));
    socket.emit('language-change', { roomId: room.id, language });
  }

  if (!room || !provider) {
    return <RoomJoinModal defaultName={savedName} onJoin={joinRoom} connectionState={connectionState} errorMessage={joinError} />;
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <button className="wordmark" type="button" onClick={leaveRoom} title="Leave workspace" aria-label="CollabCode, leave workspace">&lt;/&gt; <span>collab<span>code</span></span></button>
        <div className="room-crumb"><span className={`connection-indicator ${connectionState}`}><i /> {connectionState === 'connected' ? 'Live' : 'Reconnecting'}</span><span className="slash">/</span><span>{room.id}</span></div>
        <div className="header-actions">
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
      <section className="workspace-main">
        <div className="editor-column">
          <div className="file-tab"><span className="file-dot" /> untitled.{getFileExtension(room.language)}</div>
          <EditorPane
            key={room.id}
            room={room}
            provider={provider}
            runRequest={runRequest}
            isOutputOpen={isOutputOpen}
            onOutputVisibilityChange={setIsOutputOpen}
            onRunShortcut={() => setRunRequest((value) => value + 1)}
          />
          <footer className="editor-status"><span><i className={`status-dot ${connectionState}`} /> {connectionState === 'connected' ? 'Synced' : 'Offline changes protected'}</span><span>UTF-8</span><span>Spaces: 2</span><span>{room.language}</span></footer>
        </div>
        <ParticipantsList participants={participants} selfSocketId={socket.id} />
      </section>
    </main>
  );
}
