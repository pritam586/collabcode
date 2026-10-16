import { useState } from 'react';
import { ArrowRight, CloudOff, Copy, Inbox, Link2, MoreHorizontal, Play, Share2, Trash2, Type } from 'lucide-react';
import { Avatar, AvatarStack } from '../components/ui/Avatar.jsx';
import { Button, IconButton } from '../components/ui/Button.jsx';
import { Badge, EmptyState, Skeleton } from '../components/ui/Feedback.jsx';
import { Shortcut } from '../components/ui/Kbd.jsx';
import { Menu } from '../components/ui/Menu.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Popover } from '../components/ui/Popover.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { Tabs } from '../components/ui/Tabs.jsx';
import { TextField } from '../components/ui/TextField.jsx';
import { useToast } from '../components/ui/useToast.js';
import { ThemeToggle } from '../components/ThemeToggle.jsx';
import { StatusPage, WorkspaceSkeleton } from '../components/StatusPage.jsx';
import './kit.css';

// Throws while rendering, to show the app's error page (the ErrorBoundary in main.jsx).
function Crash() {
  throw new Error('This is a test crash from the UI kit gallery.');
}

const PEOPLE = [
  { id: 1, name: 'Ada Lovelace', color: 'violet' },
  { id: 2, name: 'Grace Hopper', color: 'cyan' },
  { id: 3, name: 'Alan Turing', color: 'amber' },
  { id: 4, name: 'Katherine Johnson', color: 'rose' },
  { id: 5, name: 'Linus T', color: 'lime' },
  { id: 6, name: 'Margaret H', color: 'sky' },
];

// Development-only gallery of the UI kit at /__kit, for checking every component and state in
// both themes. App.jsx loads it only when import.meta.env.DEV, so it never ships.
export default function KitPreview({ themeControls }) {
  const toast = useToast();
  const [tab, setTab] = useState('people');
  const [modalOpen, setModalOpen] = useState(false);
  const [wrap, setWrap] = useState(true);
  const [view, setView] = useState('split');

  // /__kit?page=… previews a full page that is hard to reach on purpose.
  const page = new URLSearchParams(window.location.search).get('page');
  if (page === 'crash') return <Crash />;
  if (page === 'skeleton') return <WorkspaceSkeleton />;
  if (page === 'join-failed') {
    return (
      <StatusPage
        icon={CloudOff}
        tone="danger"
        title="You could not join this room"
        message="Sample failure: the server could not let you into this room right now."
        onAction={() => window.location.assign('/__kit')}
      >
        <Button variant="secondary">Try again</Button>
      </StatusPage>
    );
  }

  return (
    <main className="kit">
      <header className="kit-header">
        <h1>UI kit</h1>
        <ThemeToggle {...themeControls} />
      </header>

      <section className="kit-section card">
        <h2>Buttons</h2>
        <div className="kit-row">
          <Button variant="primary" icon={<Play size={16} aria-hidden="true" />} tooltip="Run" shortcut="Mod+Enter">
            Run
          </Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger" icon={<Trash2 size={16} aria-hidden="true" />}>
            Delete
          </Button>
          <Button variant="primary" loading>
            Running
          </Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="kit-row">
          <Button variant="primary" size="lg" icon={<ArrowRight size={18} aria-hidden="true" />}>
            Create a room
          </Button>
          <Button size="lg">Join room</Button>
          <Button size="sm">Small</Button>
          <Button size="sm" variant="ghost">
            Clear
          </Button>
        </div>
        <div className="kit-row">
          <IconButton label="Share">
            <Share2 size={18} aria-hidden="true" />
          </IconButton>
          <IconButton label="Copy invite link" shortcut="Mod+Shift+C">
            <Link2 size={18} aria-hidden="true" />
          </IconButton>
          <IconButton label="Wrap lines" aria-pressed={wrap} onClick={() => setWrap((value) => !value)}>
            <Type size={18} aria-hidden="true" />
          </IconButton>
          <IconButton label="Small" size="sm">
            <Copy size={16} aria-hidden="true" />
          </IconButton>
          <Menu
            label="Room actions"
            icon={<MoreHorizontal size={18} aria-hidden="true" />}
            items={[
              { id: 'label', type: 'label', label: 'Room' },
              { id: 'copy', label: 'Copy invite link', icon: Link2, shortcut: 'Mod+Shift+C', onSelect: () => {} },
              { id: 'wrap', label: 'Wrap lines', checked: wrap, onSelect: () => setWrap((value) => !value) },
              { id: 'sep', type: 'separator' },
              { id: 'leave', label: 'Leave room', icon: Trash2, danger: true, onSelect: () => {} },
            ]}
          />
          <Popover label="Editor settings" icon={<Type size={18} aria-hidden="true" />}>
            {() => (
              <div className="menu">
                <div className="menu-row">
                  <span>Layout</span>
                  <div className="segmented" role="group" aria-label="Layout">
                    {['editor', 'split', 'output'].map((option) => (
                      <button
                        key={option}
                        type="button"
                        className="segmented-option"
                        aria-pressed={view === option}
                        onClick={() => setView(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Popover>
        </div>
      </section>

      <section className="kit-section card">
        <h2>Fields</h2>
        <div className="kit-grid">
          <TextField label="Your name" hint="Shown to everyone in the room." defaultValue="Ada" />
          <TextField label="Room code" className="kit-mono" error="Paste an invite link or a room code." />
          <TextField label="Large" size="lg" placeholder="swift-otter-4821" />
          <Select
            label="Language"
            hideLabel={false}
            options={[
              { value: 'js', label: 'JavaScript' },
              { value: 'py', label: 'Python' },
            ]}
          />
        </div>
      </section>

      <section className="kit-section card kit-tabs">
        <h2>Tabs</h2>
        <Tabs
          label="Sidebar"
          selectedId={tab}
          onSelect={setTab}
          tabs={[
            { id: 'people', label: 'People', badge: <Badge>3</Badge>, content: <p className="kit-pad">People</p> },
            {
              id: 'chat',
              label: 'Chat',
              badge: <Badge tone="brand">2</Badge>,
              content: <p className="kit-pad">Chat</p>,
            },
            { id: 'tasks', label: 'Tasks', content: <p className="kit-pad">Tasks</p> },
          ]}
        />
      </section>

      <section className="kit-section card">
        <h2>Badges, avatars and keys</h2>
        <div className="kit-row">
          <Badge>12</Badge>
          <Badge tone="accent">New</Badge>
          <Badge tone="brand">Live</Badge>
          <Badge tone="soft">JavaScript</Badge>
          <Badge tone="success" dot>
            Synced
          </Badge>
          <Badge tone="warning" dot>
            Reconnecting
          </Badge>
          <Badge tone="danger" dot>
            Offline
          </Badge>
          <Badge tone="outline">Read only</Badge>
        </div>
        <div className="kit-row">
          <Avatar name="Ada Lovelace" color="violet" size="lg" status="online" />
          <Avatar name="Grace Hopper" color="cyan" status="typing" />
          <Avatar name="Alan Turing" color="amber" size="sm" />
          <AvatarStack people={PEOPLE} />
          <Shortcut keys="Mod+Enter" />
          <Shortcut keys="Mod+/" />
        </div>
      </section>

      <section className="kit-section card">
        <h2>Loading and empty states</h2>
        <div className="kit-row">
          <Spinner />
          <Spinner size="lg" label="Loading" />
        </div>
        <div className="kit-skeleton">
          <Skeleton width="60%" />
          <Skeleton width="85%" />
          <Skeleton width="40%" />
          <Skeleton width={40} height={40} circle />
        </div>
        <EmptyState
          icon={Inbox}
          title="Start the conversation"
          action={
            <Button size="sm" variant="secondary">
              Say hello
            </Button>
          }
        >
          Messages are saved with the room, so people who join later can catch up.
        </EmptyState>
      </section>

      <section className="kit-section card">
        <h2>Overlays</h2>
        <div className="kit-row">
          <Button onClick={() => setModalOpen(true)}>Open modal</Button>
          <Button onClick={() => toast.success('Invite link copied')}>Success toast</Button>
          <Button onClick={() => toast.info('Grace joined the room')}>Info toast</Button>
          <Button onClick={() => toast.warning('Connection lost. Reconnecting…')}>Warning toast</Button>
          <Button onClick={() => toast.error('The code runner is not available.')}>Error toast</Button>
        </div>
        <div className="kit-glass-stage">
          <div className="texture-dots" />
          <div className="glass kit-glass-card">
            <strong>Glass card</strong>
            <p>Frosted surface for layers that float over content.</p>
          </div>
        </div>
      </section>

      <section className="kit-section card">
        <h2>Pages</h2>
        <div className="kit-row">
          <a className="btn btn-secondary" href="/nowhere">
            404
          </a>
          <a className="btn btn-secondary" href="/r/not%20a%20room">
            Invalid link
          </a>
          <a className="btn btn-secondary" href="/__kit?page=join-failed">
            Join failed
          </a>
          <a className="btn btn-secondary" href="/__kit?page=skeleton">
            Loading skeleton
          </a>
          <a className="btn btn-danger" href="/__kit?page=crash">
            Crash page
          </a>
        </div>
      </section>

      <Modal open={modalOpen} title="Invite people" onClose={() => setModalOpen(false)}>
        <p>Anyone with the link can join. They only pick a name.</p>
        <TextField label="Invite link" readOnly value="https://collabcode.dev/r/swift-otter-4821" />
        <div className="modal-actions">
          <Button variant="ghost" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={<Copy size={16} aria-hidden="true" />}
            onClick={() => toast.success('Invite link copied')}
          >
            Copy link
          </Button>
        </div>
      </Modal>
    </main>
  );
}
