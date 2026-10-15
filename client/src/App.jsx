import { lazy, Suspense } from 'react';
import { LandingPage } from './components/LandingPage.jsx';
import { StatusPage, WorkspaceSkeleton } from './components/StatusPage.jsx';
import { useTheme } from './hooks/usePreferences.js';
import { useRoute } from './hooks/useRoute.js';

// The room screen (sockets, Yjs and, inside it, the Monaco editor) is code-split, so the home
// page only downloads what it shows. LandingPage preloads it when someone heads for a room.
const loadRoomScreen = () => import('./components/RoomScreen.jsx');
const RoomScreen = lazy(() => loadRoomScreen().then((module) => ({ default: module.RoomScreen })));

export default function App() {
  const { route, navigate, state } = useRoute();
  const themeControls = useTheme();

  if (route.name === 'room') {
    return (
      <Suspense fallback={<WorkspaceSkeleton caption="Loading the room…" />}>
        <RoomScreen key={route.roomId} roomId={route.roomId} initialName={state?.name} navigate={navigate} themeControls={themeControls} />
      </Suspense>
    );
  }
  if (route.name === 'not-found') {
    return <StatusPage title="Page not found" message="There is nothing at this address. Start a new room or join one with an invite link." onAction={() => navigate('/')} />;
  }
  return <LandingPage navigate={navigate} themeControls={themeControls} onPrepareRoom={loadRoomScreen} />;
}
