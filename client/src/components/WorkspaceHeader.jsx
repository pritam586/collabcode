import { Ellipsis, Keyboard, Link2, LogOut, Minus, Monitor, Moon, PanelRight, Play, Plus, SquareTerminal, Sun } from 'lucide-react';
import { Avatar } from './ui/Avatar.jsx';
import { Button, IconButton } from './ui/Button.jsx';
import { MOD_KEY } from '../lib/platform.js';
import { Popover } from './ui/Popover.jsx';
import { Select } from './ui/Select.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';
import { LANGUAGES } from '../constants/languages.js';
import { FONT_SIZES } from '../hooks/usePreferences.js';

const LANGUAGE_OPTIONS = LANGUAGES.map(([value, label]) => ({ value, label }));
const THEME_OPTIONS = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

// `compact` (phones) keeps the essentials in the bar (room, share, run) and moves everything
// else into a "More" menu. Output, chat, tasks and people move to the bottom tab bar.
export function WorkspaceHeader({
  compact, roomId, status, language, onLanguageChange, onRun, isOutputOpen, onToggleOutput, fontSize, onFontSizeChange,
  themeControls, sidebarOpen, onToggleSidebar, onShare, onShowShortcuts, onLeave, participants, unreadCount,
}) {
  const live = status === 'joined';
  const runButton = (
    <Button variant="primary" icon={<Play size={16} aria-hidden="true" />} onClick={onRun} title={`Run code (${MOD_KEY}+Enter)`} aria-keyshortcuts="Control+Enter Meta+Enter" data-tour="run">
      <span className="hide-narrow">Run</span>
    </Button>
  );

  return (
    <header className="workspace-header">
      <div className="header-start">
        <button type="button" className="brand brand-button" onClick={onLeave} aria-label="CollabCode home (leaves this room)" title="Back to home">
          <span className="brand-mark" aria-hidden="true">&lt;/&gt;</span>
          {!compact && <span className="brand-name">CollabCode</span>}
        </button>
        <div className="room-chip">
          <span className={`connection-dot ${live ? 'is-live' : 'is-offline'}`} aria-hidden="true" />
          <span className="sr-only">{live ? 'Connected to room' : 'Reconnecting to room'}</span>
          <span className="room-chip-code" title={roomId}>{roomId}</span>
          {compact ? (
            <IconButton label="Copy the invite link" onClick={onShare} data-tour="share"><Link2 size={18} aria-hidden="true" /></IconButton>
          ) : (
            <Button size="sm" variant="secondary" icon={<Link2 size={14} aria-hidden="true" />} onClick={onShare} data-tour="share" title="Copy the invite link">
              <span className="hide-narrow">Share</span>
            </Button>
          )}
        </div>
      </div>

      {compact ? (
        <div className="header-tools" role="group" aria-label="Editor tools">
          {runButton}
          <Popover label="More options" icon={<Ellipsis size={20} aria-hidden="true" />} buttonProps={{ 'data-tour': 'shortcuts' }}>
            {({ close }) => (
              <div className="menu">
                <Select label="Editor language" hideLabel={false} className="menu-field" value={language} options={LANGUAGE_OPTIONS} onChange={(event) => onLanguageChange(event.target.value)} />
                <div className="menu-row">
                  <span className="field-label" id="menu-font-size">Font size</span>
                  <FontSizeControl fontSize={fontSize} onChange={onFontSizeChange} labelledBy="menu-font-size" />
                </div>
                <div className="menu-row">
                  <span className="field-label" id="menu-theme">Theme</span>
                  <div className="segmented" role="group" aria-labelledby="menu-theme">
                    {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                      <button key={value} type="button" className="segmented-option" aria-pressed={themeControls.preference === value} onClick={() => themeControls.setPreference(value)}>
                        <Icon size={16} aria-hidden="true" /> {label}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="button" className="menu-item" onClick={() => { close(); onShowShortcuts(); }}><Keyboard size={18} aria-hidden="true" /> Keyboard shortcuts</button>
                <button type="button" className="menu-item menu-item-danger" onClick={onLeave}><LogOut size={18} aria-hidden="true" /> Leave room</button>
              </div>
            )}
          </Popover>
        </div>
      ) : (
        <div className="header-tools" role="group" aria-label="Editor tools">
          <Select label="Editor language" value={language} options={LANGUAGE_OPTIONS} onChange={(event) => onLanguageChange(event.target.value)} />
          {runButton}
          <IconButton label={isOutputOpen ? 'Hide output panel' : 'Show output panel'} aria-pressed={isOutputOpen} onClick={onToggleOutput}>
            <SquareTerminal size={18} aria-hidden="true" />
          </IconButton>
          <FontSizeControl className="hide-tablet" fontSize={fontSize} onChange={onFontSizeChange} />
          <ThemeToggle {...themeControls} />
          <IconButton label="Keyboard shortcuts" className="hide-tablet" onClick={onShowShortcuts} data-tour="shortcuts"><Keyboard size={18} aria-hidden="true" /></IconButton>

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
      )}
    </header>
  );
}

function FontSizeControl({ fontSize, onChange, className = '', labelledBy }) {
  return (
    <div className={`font-size-control ${className}`} role="group" aria-label={labelledBy ? undefined : 'Editor font size'} aria-labelledby={labelledBy}>
      <IconButton size="sm" label="Decrease font size" disabled={fontSize <= FONT_SIZES.min} onClick={() => onChange(fontSize - 1)}><Minus size={14} aria-hidden="true" /></IconButton>
      <output className="font-size-value" aria-live="polite" aria-label={`Font size ${fontSize} pixels`}>{fontSize}</output>
      <IconButton size="sm" label="Increase font size" disabled={fontSize >= FONT_SIZES.max} onClick={() => onChange(fontSize + 1)}><Plus size={14} aria-hidden="true" /></IconButton>
    </div>
  );
}
