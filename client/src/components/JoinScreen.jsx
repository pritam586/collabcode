import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Link2 } from 'lucide-react';
import { AuroraBackdrop } from './AuroraBackdrop.jsx';
import { Logo } from './Logo.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';
import { Button } from './ui/Button.jsx';
import { CopyButton } from './ui/CopyButton.jsx';
import { TextField } from './ui/TextField.jsx';
import { randomGuestName, roomUrl } from '../lib/rooms.js';
import { readSavedName, saveName } from '../hooks/usePreferences.js';

// "swift-otter-4821" -> ["swift", "-", "otter", "-", "4821"], so separators can be dimmed.
const codeParts = (roomId) => roomId.split(/([-._])/).filter(Boolean);

// Shown when someone opens an invite link: a centered card that names the room, lets them copy
// the link to pass it on, and asks only for a display name.
export function JoinScreen({ roomId, onJoin, onCancel, themeControls }) {
  const [name, setName] = useState(() => readSavedName() || randomGuestName());
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function submit(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a name so others know who you are.');
      inputRef.current?.focus();
      return;
    }
    saveName(trimmed);
    onJoin(trimmed);
  }

  return (
    <div className="join-screen">
      <AuroraBackdrop />
      <header className="join-nav">
        <Logo />
        {themeControls && <ThemeToggle {...themeControls} />}
      </header>

      <main className="join-main">
        <section className="join-card glass" aria-labelledby="join-title">
          <p className="join-pill">
            <Link2 size={14} aria-hidden="true" />
            You have been invited
          </p>
          <h1 id="join-title">Join this room</h1>

          <div className="room-code-row">
            <p className="room-code-display" aria-label={`Room code ${roomId}`}>
              {codeParts(roomId).map((part, index) => (
                <span key={index} className={/^[-._]$/.test(part) ? 'room-code-sep' : 'room-code-part'}>
                  {part}
                </span>
              ))}
            </p>
            <CopyButton text={roomUrl(roomId)} label="Copy invite link" size="sm" />
          </div>

          <form className="join-form" onSubmit={submit} noValidate>
            <TextField
              ref={inputRef}
              label="Your name"
              hint="This is what others in the room see. No account needed."
              size="lg"
              value={name}
              maxLength={32}
              autoComplete="nickname"
              error={error}
              onChange={(event) => {
                setName(event.target.value);
                setError('');
              }}
            />
            <Button type="submit" variant="primary" size="lg" block icon={<ArrowRight size={18} aria-hidden="true" />}>
              Join room
            </Button>
          </form>

          <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} aria-hidden="true" />} onClick={onCancel}>
            Back to home
          </Button>
        </section>
      </main>
    </div>
  );
}
