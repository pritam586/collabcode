import { Keyboard, Link2, LogOut, Minus, PanelRight, Play, Plus, SquareTerminal } from 'lucide-react';
import { Avatar } from './ui/Avatar.jsx';
import { Button, IconButton } from './ui/Button.jsx';
import { MOD_KEY } from './ui/Kbd.jsx';
import { Select } from './ui/Select.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';
import { LANGUAGES } from '../constants/languages.js';
import { FONT_SIZES } from '../hooks/usePreferences.js';

const LANGUAGE_OPTIONS = LANGUAGES.map(([value, label]) => ({ value, label }));

export function WorkspaceHeader({
  roomId, status, language, onLanguageChange, onRun, isOutputOpen, onToggleOutput, fontSize, onFontSizeChange,
  themeControls, sidebarOpen, onToggleSidebar, onShare, onShowShortcuts, onLeave, participants, unreadCount,
}) {
  const live = status === 'joined';
  return (
    <header className="workspace-header">
      <div className="header-start">
        <button type="button" className="brand brand-button" onClick={onLeave} aria-label="CollabCode home (leaves this room)" title="Back to home">
          <span className="brand-mark" aria-hidden="true">&lt;/&gt;</span>
          <span className="brand-name">CollabCode</span>
        </button>
        <div className="room-chip">
          <span className={`connection-dot ${live ? 'is-live' : 'is-offline'}`} aria-hidden="true" />
          <span className="sr-only">{live ? 'Connected to room' : 'Reconnecting to room'}</span>
          <span className="room-chip-code" title={roomId}>{roomId}</span>
          <Button size="sm" variant="secondary" icon={<Link2 size={14} aria-hidden="true" />} onClick={onShare} data-tour="share" title="Copy the invite link">
            <span className="hide-narrow">Share</span>
          </Button>
        </div>
      </div>

      <div className="header-tools" role="group" aria-label="Editor tools">
        <Select label="Editor language" value={language} options={LANGUAGE_OPTIONS} onChange={(event) => onLanguageChange(event.target.value)} />
        <Button variant="primary" icon={<Play size={16} aria-hidden="true" />} onClick={onRun} title={`Run code (${MOD_KEY}+Enter)`} aria-keyshortcuts="Control+Enter Meta+Enter" data-tour="run">
          <span className="hide-narrow">Run</span>
        </Button>
        <IconButton label={isOutputOpen ? 'Hide output panel' : 'Show output panel'} aria-pressed={isOutputOpen} onClick={onToggleOutput}>
          <SquareTerminal size={18} aria-hidden="true" />
        </IconButton>

        <div className="font-size-control hide-compact" role="group" aria-label="Editor font size">
          <IconButton size="sm" label="Decrease font size" disabled={fontSize <= FONT_SIZES.min} onClick={() => onFontSizeChange(fontSize - 1)}><Minus size={14} aria-hidden="true" /></IconButton>
          <output className="font-size-value" aria-live="polite" aria-label={`Font size ${fontSize} pixels`}>{fontSize}</output>
          <IconButton size="sm" label="Increase font size" disabled={fontSize >= FONT_SIZES.max} onClick={() => onFontSizeChange(fontSize + 1)}><Plus size={14} aria-hidden="true" /></IconButton>
        </div>

        <ThemeToggle {...themeControls} />
        <IconButton label="Keyboard shortcuts" className="hide-compact" onClick={onShowShortcuts} data-tour="shortcuts"><Keyboard size={18} aria-hidden="true" /></IconButton>

        <button
          type="button"
          className="people-button"
          aria-pressed={sidebarOpen}
          aria-controls="workspace-sidebar"
          aria-label={`${sidebarOpen ? 'Hide' : 'Show'} sidebar: ${participants.length} ${participants.length === 1 ? 'person' : 'people'} here${unreadCount ? `, ${unreadCount} unread ${unreadCount === 1 ? 'message' : 'messages'}` : ''}`}
          title={sidebarOpen ? 'Hide sidebar' : 'Show people, chat and tasks'}
          onClick={onToggleSidebar}
          data-tour="sidebar"
        >
          <span className="avatar-stack" aria-hidden="true">
            {participants.slice(0, 3).map((person) => <Avatar key={person.socketId} name={person.name} color={person.color} size="sm" />)}
          </span>
          {participants.length > 3 && <span className="people-more" aria-hidden="true">+{participants.length - 3}</span>}
          <PanelRight size={18} aria-hidden="true" />
          {unreadCount > 0 && <span className="badge badge-accent people-unread" aria-hidden="true">{unreadCount}</span>}
        </button>

        <IconButton label="Leave room" onClick={onLeave}><LogOut size={18} aria-hidden="true" /></IconButton>
      </div>
    </header>
  );
}
