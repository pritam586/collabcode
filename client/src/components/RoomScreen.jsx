import { useState } from 'react';
import { CloudOff, Link2Off, RotateCw } from 'lucide-react';
import { JoinScreen } from './JoinScreen.jsx';
import { StatusPage, WorkspaceSkeleton } from './StatusPage.jsx';
import { Workspace } from './Workspace.jsx';
import { Button } from './ui/Button.jsx';
import { useRoomSession } from '../hooks/useRoomSession.js';
import { ROOM_ID_PATTERN } from '../lib/rooms.js';

// /r/<roomId>: asks for a name if the visitor came from an invite link, then joins.
export function RoomScreen({ roomId, initialName, navigate, themeControls }) {
  const [name, setName] = useState(initialName || null);
  // Bumped by "Try again" after a failed join, which starts a fresh session.
  const [attempt, setAttempt] = useState(0);

  if (!ROOM_ID_PATTERN.test(roomId)) {
    return (
      <StatusPage
        icon={Link2Off}
        title="That link does not look right"
        message="Room codes use letters, numbers, dots, dashes and underscores. Check the invite link, or start a new room."
        onAction={() => navigate('/')}
      />
    );
  }
  if (!name) {
    return <JoinScreen roomId={roomId} onJoin={setName} onCancel={() => navigate('/')} themeControls={themeControls} />;
  }
  return (
    <RoomSession
      key={`${roomId}:${name}:${attempt}`}
      roomId={roomId}
      name={name}
      navigate={navigate}
      themeControls={themeControls}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}

function RoomSession({ roomId, name, navigate, themeControls, onRetry }) {
  const session = useRoomSession(roomId, name);

  if (session.status === 'failed') {
    return (
      <StatusPage
        icon={CloudOff}
        tone="danger"
        title="You could not join this room"
        message={session.failure}
        onAction={() => navigate('/')}
      >
        <Button variant="secondary" icon={<RotateCw size={16} aria-hidden="true" />} onClick={onRetry}>
          Try again
        </Button>
      </StatusPage>
    );
  }
  if (!session.provider) return <WorkspaceSkeleton />;
  return <Workspace roomId={roomId} name={name} session={session} navigate={navigate} themeControls={themeControls} />;
}
