import { useRef, useState } from 'react';
import {
  ArrowRight,
  Code2,
  Link2,
  ListChecks,
  MessageSquare,
  MonitorSmartphone,
  MousePointer2,
  Play,
  Plus,
  SunMoon,
  UserRoundCheck,
  WifiOff,
  Zap,
} from 'lucide-react';
import { Button } from './ui/Button.jsx';
import { TextField } from './ui/TextField.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';
import { Logo } from './Logo.jsx';
import { EditorMockup } from './landing/EditorMockup.jsx';
import { generateRoomId, parseRoomInput, randomGuestName, roomPath } from '../lib/rooms.js';
import { readSavedName, saveName } from '../hooks/usePreferences.js';

const FEATURES = [
  {
    icon: Zap,
    title: 'Real-time sync',
    text: 'Edits merge as you type, even on the same line. Work offline and it catches up when you reconnect.',
  },
  {
    icon: MessageSquare,
    title: 'Chat built in',
    text: 'Talk it through next to the code. History stays with the room for anyone who joins later.',
  },
  {
    icon: Play,
    title: 'Run code',
    text: 'Run JavaScript, TypeScript, Python, Java and C++ in a locked-down sandbox and read the output right there.',
  },
  {
    icon: ListChecks,
    title: 'Shared tasks',
    text: 'A to-do list the whole room can add to and tick off, synced just like the code.',
  },
];

const EXTRAS = [
  { icon: MousePointer2, label: 'Live cursors' },
  { icon: WifiOff, label: 'Works offline' },
  { icon: UserRoundCheck, label: 'No sign-up' },
  { icon: MonitorSmartphone, label: 'Phone friendly' },
  { icon: SunMoon, label: 'Light and dark' },
];

const STEPS = [
  {
    icon: Plus,
    title: 'Create a room',
    text: (
      <>
        One click gives you a private room with a link like <code>/r/swift-otter-4821</code>.
      </>
    ),
  },
  { icon: Link2, title: 'Share the link', text: 'Anyone with it can join from a browser. They only pick a name.' },
  { icon: Code2, title: 'Build together', text: 'Edit, run, chat and track tasks in one place, as it happens.' },
];

// Feature cards light up under the pointer: the card's --spot-x/--spot-y follow it.
function trackSpotlight(event) {
  const card = event.target instanceof Element ? event.target.closest('.feature') : null;
  if (!card) return;
  const box = card.getBoundingClientRect();
  card.style.setProperty('--spot-x', `${event.clientX - box.left}px`);
  card.style.setProperty('--spot-y', `${event.clientY - box.top}px`);
}

export function LandingPage({ navigate, themeControls, onPrepareRoom }) {
  const [name, setName] = useState(() => readSavedName() || randomGuestName());
  const [joinCode, setJoinCode] = useState('');
  const [nameError, setNameError] = useState('');
  const [joinError, setJoinError] = useState('');
  const nameRef = useRef(null);

  function confirmName() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Enter a name so others know who you are.');
      nameRef.current?.focus();
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
      <div className="landing-backdrop" aria-hidden="true">
        <div className="aurora">
          <span className="aurora-blob aurora-blob-1" />
          <span className="aurora-blob aurora-blob-2" />
          <span className="aurora-blob aurora-blob-3" />
        </div>
        <div className="texture-dots" />
        <div className="texture-grain" />
      </div>

      <header className="landing-nav">
        <a className="landing-home" href="/" aria-label="CollabCode home">
          <Logo />
        </a>
        <nav className="landing-links" aria-label="Page sections">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <ThemeToggle {...themeControls} />
      </header>

      <main className="landing-main">
        <section className="hero" aria-labelledby="hero-title">
          <p className="hero-pill">
            <span className="live-dot" aria-hidden="true" />
            Real-time collaborative code editor
          </p>
          <h1 id="hero-title">
            Code together, <span className="text-gradient">in the same file,</span> right now.
          </h1>
          <p className="hero-copy">
            Open a room, share the link, and build side by side with live cursors, chat, shared tasks and a sandboxed
            code runner. No accounts, no installs.
          </p>

          <div className="start-card glass" role="group" aria-label="Start collaborating">
            <TextField
              ref={nameRef}
              label="Your name"
              hint="Shown to everyone in the room. No sign-up needed."
              size="lg"
              value={name}
              maxLength={32}
              autoComplete="nickname"
              error={nameError}
              onChange={(event) => {
                setName(event.target.value);
                setNameError('');
              }}
              action={
                <Button
                  variant="primary"
                  size="lg"
                  icon={<ArrowRight size={18} aria-hidden="true" />}
                  onClick={createRoom}
                  onPointerEnter={onPrepareRoom}
                  onFocus={onPrepareRoom}
                >
                  Create a room
                </Button>
              }
            />

            <div className="divider" role="separator">
              <span>or join one</span>
            </div>

            <form className="join-form" onSubmit={joinRoom} onFocus={onPrepareRoom} noValidate>
              <TextField
                label="Room code or invite link"
                placeholder="swift-otter-4821"
                size="lg"
                mono
                value={joinCode}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                error={joinError}
                onChange={(event) => {
                  setJoinCode(event.target.value);
                  setJoinError('');
                }}
                action={
                  <Button type="submit" variant="secondary" size="lg">
                    Join room
                  </Button>
                }
              />
            </form>
          </div>
        </section>

        <section className="showcase" aria-label="Product preview">
          <div className="showcase-glow" aria-hidden="true" />
          <EditorMockup />
        </section>

        <section className="features" id="features" aria-labelledby="features-title">
          <div className="section-heading">
            <p className="eyebrow">Features</p>
            <h2 id="features-title">Everything you need to pair, nothing you don&rsquo;t</h2>
            <p>One link opens a shared editor with the tools a pairing session actually uses.</p>
          </div>
          <ul className="feature-grid" onPointerMove={trackSpotlight}>
            {FEATURES.map(({ icon: Icon, title, text }, index) => (
              <li key={title} className="feature" style={{ '--i': index }}>
                <span className="feature-icon" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ul>
          <ul className="extras" aria-label="Also included">
            {EXTRAS.map(({ icon: Icon, label }) => (
              <li key={label}>
                <Icon size={16} aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </section>

        <section className="how-it-works" id="how-it-works" aria-labelledby="how-title">
          <div className="section-heading">
            <p className="eyebrow">How it works</p>
            <h2 id="how-title">From zero to pairing in three steps</h2>
          </div>
          <ol className="steps">
            {STEPS.map(({ icon: Icon, title, text }, index) => (
              <li key={title} className="step" style={{ '--i': index }}>
                <span className="step-number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="step-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="cta-band" aria-labelledby="cta-title">
          <div className="cta-glow" aria-hidden="true" />
          <h2 id="cta-title">Your next pairing session is one click away</h2>
          <p>Free, private rooms. Nothing to install.</p>
          <Button
            variant="primary"
            size="lg"
            icon={<ArrowRight size={18} aria-hidden="true" />}
            onClick={createRoom}
            onPointerEnter={onPrepareRoom}
            onFocus={onPrepareRoom}
          >
            Start a new room
          </Button>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <Logo />
            <p>Real-time collaborative coding in the browser.</p>
          </div>
          <nav className="footer-links" aria-label="Footer">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#hero-title">Back to top</a>
          </nav>
        </div>
        <p className="footer-note">Rooms you stop using are deleted after 30 days.</p>
      </footer>
    </div>
  );
}
