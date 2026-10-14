import { useState } from 'react';
import { JoinDialog } from './JoinDialog.jsx';
import { StatusPage, WorkspaceSkeleton } from './StatusPage.jsx';
import { Workspace } from './Workspace.jsx';
import { useRoomSession } from '../hooks/useRoomSession.js';
import { ROOM_ID_PATTERN } from '../lib/rooms.js';

// /r/<roomId>: asks for a name if the visitor came from an invite link, then joins.
export function RoomScreen({ roomId, initialName, navigate, themeControls }) {
  const [name, setName] = useState(initialName || null);

  if (!ROOM_ID_PATTERN.test(roomId)) {
    return <StatusPage title="That link does not look right" message="Room codes use letters, numbers, dots, dashes and underscores. Check the invite link, or start a new room." onAction={() => navigate('/')} />;
  }
  if (!name) {
    return (
      <>
        <WorkspaceSkeleton caption={null} />
        <JoinDialog roomId={roomId} onJoin={setName} onCancel={() => navigate('/')} />
      </>
    );
  }
  return <RoomSession key={`${roomId}:${name}`} roomId={roomId} name={name} navigate={navigate} themeControls={themeControls} />;
}

function RoomSession({ roomId, name, navigate, themeControls }) {
  const session = useRoomSession(roomId, name);

  if (session.status === 'failed') {
    return <StatusPage title="You could not join this room" message={session.failure} onAction={() => navigate('/')} />;
  }
  if (!session.provider) return <WorkspaceSkeleton />;
  return <Workspace roomId={roomId} name={name} session={session} navigate={navigate} themeControls={themeControls} />;
}
