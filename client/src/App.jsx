import { LandingPage } from './components/LandingPage.jsx';
import { RoomScreen } from './components/RoomScreen.jsx';
import { StatusPage } from './components/StatusPage.jsx';
import { useTheme } from './hooks/usePreferences.js';
import { useRoute } from './hooks/useRoute.js';

export default function App() {
  const { route, navigate, state } = useRoute();
  const themeControls = useTheme();

  if (route.name === 'room') {
    return <RoomScreen key={route.roomId} roomId={route.roomId} initialName={state?.name} navigate={navigate} themeControls={themeControls} />;
  }
  if (route.name === 'not-found') {
    return <StatusPage title="Page not found" message="There is nothing at this address. Start a new room or join one with an invite link." onAction={() => navigate('/')} />;
  }
  return <LandingPage navigate={navigate} themeControls={themeControls} />;
}
