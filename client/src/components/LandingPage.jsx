import { useState } from 'react';
import { ArrowRight, Code2, ListChecks, MessageSquare, MousePointer2, Play, WifiOff } from 'lucide-react';
import { Button } from './ui/Button.jsx';
import { TextField } from './ui/TextField.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';
import { generateRoomId, parseRoomInput, randomGuestName, roomPath } from '../lib/rooms.js';
import { readSavedName, saveName } from '../hooks/usePreferences.js';

const FEATURES = [
  { icon: MousePointer2, title: 'Live cursors', text: 'See who is in the room, where they are working, and who is typing.' },
  { icon: Play, title: 'Run code', text: 'Run JavaScript, TypeScript, Python, Java and C++ in a locked-down sandbox.' },
  { icon: MessageSquare, title: 'Chat built in', text: 'Talk it through next to the code, with history kept for the room.' },
  { icon: ListChecks, title: 'Shared tasks', text: 'Keep a to-do list everyone in the room can tick off.' },
  { icon: WifiOff, title: 'Works offline', text: 'Keep typing through a dropped connection; edits merge when you are back.' },
  { icon: Code2, title: 'No sign-up', text: 'Pick a name and share a link. That is the whole setup.' },
];

export function LandingPage({ navigate, themeControls }) {
  const [name, setName] = useState(() => readSavedName() || randomGuestName());
  const [joinCode, setJoinCode] = useState('');
  const [nameError, setNameError] = useState('');
  const [joinError, setJoinError] = useState('');

  function confirmName() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Enter a name so others know who you are.');
      return null;
    }
    saveName(trimmed);
    return trimmed;
  }

  function createRoom() {
    const confirmed = confirmName();
    if (confirmed) navigate(roomPath(generateRoomId()), { state: { name: confirmed } });
  }

  function joinRoom(event) {
    event.preventDefault();
    const roomId = parseRoomInput(joinCode);
    if (!roomId) {
      setJoinError('Paste an invite link or a room code like swift-otter-4821.');
      return;
    }
    const confirmed = confirmName();
    if (confirmed) navigate(roomPath(roomId), { state: { name: confirmed } });
  }

  return (
    <div className="landing">
      <header className="landing-nav">
        <span className="brand"><span className="brand-mark" aria-hidden="true">&lt;/&gt;</span> CollabCode</span>
        <ThemeToggle {...themeControls} />
      </header>

      <main className="landing-main">
        <section className="hero" aria-labelledby="hero-title">
          <p className="eyebrow">Real-time collaborative code editor</p>
          <h1 id="hero-title">Code together, <span>in the same file,</span> right now.</h1>
          <p className="hero-copy">Open a room, send the link, and edit side by side with live cursors, chat, shared tasks and a sandboxed code runner. No accounts, no installs.</p>
        </section>

        <section className="start-card" aria-label="Start collaborating">
          <TextField
            label="Your name"
            hint="Shown to everyone in the room. No sign-up needed."
            value={name}
            maxLength={32}
            autoComplete="nickname"
            error={nameError}
            onChange={(event) => { setName(event.target.value); setNameError(''); }}
          />
          <Button variant="primary" size="lg" block icon={<ArrowRight size={18} aria-hidden="true" />} onClick={createRoom}>
            Create a room
          </Button>

          <div className="divider" role="separator"><span>or join one</span></div>

          <form className="join-form" onSubmit={joinRoom} noValidate>
            <TextField
              label="Room code or invite link"
              placeholder="swift-otter-4821"
              value={joinCode}
              autoComplete="off"
              spellCheck={false}
              error={joinError}
              onChange={(event) => { setJoinCode(event.target.value); setJoinError(''); }}
            />
            <Button type="submit" variant="secondary" block>Join room</Button>
          </form>
        </section>

        <section className="features" aria-labelledby="features-title">
          <h2 id="features-title" className="sr-only">Features</h2>
          <ul className="feature-grid">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="feature">
                <Icon size={20} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="how-it-works" aria-labelledby="how-title">
          <h2 id="how-title">How it works</h2>
          <ol>
            <li><strong>Create a room.</strong> You get a private link like <code>/r/swift-otter-4821</code>.</li>
            <li><strong>Share the link.</strong> Anyone with it can join; they just pick a name.</li>
            <li><strong>Build together.</strong> Edit, run, chat and track tasks in one place.</li>
          </ol>
        </section>
      </main>

      <footer className="landing-footer">Rooms you stop using are deleted after 30 days.</footer>
    </div>
  );
}
