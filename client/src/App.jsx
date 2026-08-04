import { useEffect, useRef, useState } from 'react';
import { EditorPane } from './components/EditorPane.jsx';
import { LanguageSelector } from './components/LanguageSelector.jsx';
import { ParticipantsList } from './components/ParticipantsList.jsx';
import { RoomJoinModal } from './components/RoomJoinModal.jsx';
import { socket } from './socket.js';

const savedName = window.localStorage.getItem('collabcode-name') || `Guest ${Math.floor(100 + Math.random() * 900)}`;

export default function App() {
  const [connectionState, setConnectionState] = useState(socket.connected ? 'connected' : 'connecting');
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [remoteCursors, setRemoteCursors] = useState({});
  const [notice, setNotice] = useState('');
  const [syncKey, setSyncKey] = useState(0);
  const requestedRoomRef = useRef(null);

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
      setRoom((current) => ({
        id: snapshot.roomId,
        name: requestedRoomRef.current?.name || current?.name || savedName,
        content: snapshot.content,
        version: snapshot.version,
        language: snapshot.language,
      }));
      setParticipants(snapshot.participants);
      setRemoteCursors({});
      setSyncKey((value) => value + 1);
      setNotice('');
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
      socket.disconnect();
    };
  }, []);

  function joinRoom({ roomId, name }) {
    if (!roomId || !name) return;
    window.localStorage.setItem('collabcode-name', name);
    requestedRoomRef.current = { roomId, name };
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
  }

  function changeLanguage(language) {
    if (!room) return;
    setRoom((current) => ({ ...current, language }));
    socket.emit('language-change', { roomId: room.id, language });
  }

  if (!room) {
    return <RoomJoinModal defaultName={savedName} onJoin={joinRoom} connectionState={connectionState} />;
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <button className="wordmark" type="button" onClick={leaveRoom} title="Leave workspace">&lt;/&gt; <span>collab<span>code</span></span></button>
        <div className="room-crumb"><span className="connection-indicator"><i /> Live</span><span className="slash">/</span><span>{room.id}</span></div>
        <div className="header-actions">
          <span className="version-label">v{room.version}</span>
          <LanguageSelector language={room.language} onChange={changeLanguage} />
          <button className="leave-button" type="button" onClick={leaveRoom}>Leave</button>
        </div>
      </header>

      {notice && <div className="notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notice">×</button></div>}

      <section className="workspace-main">
        <div className="editor-column">
          <div className="file-tab"><span className="file-dot" /> untitled.{room.language === 'javascript' ? 'js' : room.language}</div>
          <EditorPane
            key={room.id}
            room={room}
            syncKey={syncKey}
            remoteCursors={remoteCursors}
            onVersionChange={(version) => setRoom((current) => current ? { ...current, version } : current)}
            onLanguageResync={(language) => setRoom((current) => current && language ? { ...current, language } : current)}
            onNotice={setNotice}
          />
          <footer className="editor-status"><span><i className="status-dot connected" /> Synced</span><span>UTF-8</span><span>Spaces: 2</span><span>{room.language}</span></footer>
        </div>
        <ParticipantsList participants={participants} selfSocketId={socket.id} />
      </section>
    </main>
  );
}
