import {
  Ellipsis,
  Keyboard,
  Link2,
  LogOut,
  Minus,
  Monitor,
  Moon,
  PanelRight,
  Play,
  Plus,
  Share2,
  SquareTerminal,
  Sun,
} from 'lucide-react';
import { AvatarStack } from './ui/Avatar.jsx';
import { Button, IconButton } from './ui/Button.jsx';
import { Popover } from './ui/Popover.jsx';
import { Select } from './ui/Select.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';
import { LogoMark } from './Logo.jsx';
import { LANGUAGES } from '../constants/languages.js';
import { FONT_SIZES } from '../hooks/usePreferences.js';

const LANGUAGE_OPTIONS = LANGUAGES.map(([value, label]) => ({ value, label }));
const THEME_OPTIONS = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

// The workspace top bar: brand and room on the left, editing tools in the middle, people and
// settings on the right. `compact` (phones) keeps the room, share, run and a "More" menu;
// output, chat, tasks and people move to the bottom tab bar.
export function WorkspaceHeader({
  compact,
  roomId,
  status,
  language,
  onLanguageChange,
  onRun,
  isOutputOpen,
  onToggleOutput,
  fontSize,
  onFontSizeChange,
  themeControls,
  sidebarOpen,
  onToggleSidebar,
  onShare,
  onShowShortcuts,
  onLeave,
  participants,
  unreadCount,
}) {
  const live = status === 'joined';
  const peopleLabel = `${participants.length} ${participants.length === 1 ? 'person' : 'people'} here`;
  const unreadLabel = unreadCount ? `, ${unreadCount} unread ${unreadCount === 1 ? 'message' : 'messages'}` : '';

  return (
    <header className="workspace-header">
      <div className="header-start">
        <button
          type="button"
          className="brand brand-button"
          onClick={onLeave}
          aria-label="CollabCode home (leaves this room)"
          data-tooltip="Back to home"
          data-tooltip-placement="bottom"
        >
          <LogoMark />
          {!compact && <span className="brand-name hide-tablet">CollabCode</span>}
        </button>
        <span className="header-divider" aria-hidden="true" />
        <div className="room-chip" data-tooltip={live ? 'Connected' : 'Reconnecting…'} data-tooltip-placement="bottom">
          <span className={`connection-dot ${live ? 'is-live' : 'is-offline'}`} aria-hidden="true" />
          <span className="sr-only">{live ? 'Connected to room' : 'Reconnecting to room'}</span>
          <span className="room-chip-code">{roomId}</span>
          {compact && (
            <IconButton label="Copy the invite link" onClick={onShare} data-tour="share">
              <Link2 size={18} aria-hidden="true" />
            </IconButton>
          )}
        </div>
      </div>

      <div className="header-center" role="group" aria-label="Editor tools">
        {!compact && (
          <span className={`language-select language-${language}`}>
            <span className={`file-dot file-dot-${language}`} aria-hidden="true" />
            <Select
              label="Editor language"
              value={language}
              options={LANGUAGE_OPTIONS}
              onChange={(event) => onLanguageChange(event.target.value)}
            />
          </span>
        )}
        <Button
          variant="primary"
          className="run-button"
          icon={<Play size={15} aria-hidden="true" fill="currentColor" />}
          onClick={onRun}
          tooltip="Run the code"
          shortcut="Mod+Enter"
          aria-keyshortcuts="Control+Enter Meta+Enter"
          data-tour="run"
        >
          <span className="hide-narrow">Run</span>
        </Button>
        {!compact && (
          <IconButton
            label={isOutputOpen ? 'Hide output panel' : 'Show output panel'}
            aria-pressed={isOutputOpen}
            onClick={onToggleOutput}
          >
            <SquareTerminal size={18} aria-hidden="true" />
          </IconButton>
        )}
      </div>

      <div className="header-end">
        {!compact && (
          <>
            <Button
              size="sm"
              variant="secondary"
              className="share-button"
              icon={<Share2 size={14} aria-hidden="true" />}
              onClick={onShare}
              tooltip="Copy the invite link"
              data-tour="share"
            >
              Share
            </Button>
            <button
              type="button"
              className="people-button"
              aria-pressed={sidebarOpen}
              aria-controls="workspace-sidebar"
              aria-label={`${sidebarOpen ? 'Hide' : 'Show'} sidebar: ${peopleLabel}${unreadLabel}`}
              data-tooltip={sidebarOpen ? 'Hide people, chat and tasks' : 'Show people, chat and tasks'}
              data-tooltip-placement="bottom"
              onClick={onToggleSidebar}
              data-tour="sidebar"
            >
              <AvatarStack
                people={participants.map((person) => ({ id: person.socketId, name: person.name, color: person.color }))}
                max={3}
                size="sm"
                label={peopleLabel}
              />
              <PanelRight size={16} aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="badge badge-brand people-unread" aria-hidden="true">
                  {unreadCount}
                </span>
              )}
            </button>
            <ThemeToggle {...themeControls} />
          </>
        )}
        <Popover
          label={compact ? 'More options' : 'Editor settings'}
          icon={<Ellipsis size={20} aria-hidden="true" />}
          buttonProps={{ 'data-tour': 'shortcuts' }}
        >
          {({ close }) => (
            <div className="menu">
              {compact && (
                <Select
                  label="Editor language"
                  hideLabel={false}
                  className="menu-field"
                  value={language}
                  options={LANGUAGE_OPTIONS}
                  onChange={(event) => onLanguageChange(event.target.value)}
                />
              )}
              <div className="menu-row">
                <span className="field-label" id="menu-font-size">
                  Font size
                </span>
                <FontSizeControl fontSize={fontSize} onChange={onFontSizeChange} labelledBy="menu-font-size" />
              </div>
              {compact && (
                <div className="menu-row">
                  <span className="field-label" id="menu-theme">
                    Theme
                  </span>
                  <div className="segmented" role="group" aria-labelledby="menu-theme">
                    {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        className="segmented-option"
                        aria-pressed={themeControls.preference === value}
                        onClick={() => themeControls.setPreference(value)}
                      >
                        <Icon size={16} aria-hidden="true" /> {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <hr className="menu-separator" />
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  close();
                  onShowShortcuts();
                }}
              >
                <Keyboard size={16} aria-hidden="true" />
                <span className="menu-item-label">Keyboard shortcuts</span>
                <kbd className="kbd" aria-hidden="true">
                  ?
                </kbd>
              </button>
              <button type="button" className="menu-item menu-item-danger" onClick={onLeave}>
                <LogOut size={16} aria-hidden="true" />
                <span className="menu-item-label">Leave room</span>
              </button>
            </div>
          )}
        </Popover>
      </div>
    </header>
  );
}

function FontSizeControl({ fontSize, onChange, labelledBy }) {
  return (
    <div className="font-size-control" role="group" aria-labelledby={labelledBy}>
      <IconButton
        size="sm"
        label="Decrease font size"
        disabled={fontSize <= FONT_SIZES.min}
        onClick={() => onChange(fontSize - 1)}
      >
        <Minus size={14} aria-hidden="true" />
      </IconButton>
      <output className="font-size-value" aria-live="polite" aria-label={`Font size ${fontSize} pixels`}>
        {fontSize}
      </output>
      <IconButton
        size="sm"
        label="Increase font size"
        disabled={fontSize >= FONT_SIZES.max}
        onClick={() => onChange(fontSize + 1)}
      >
        <Plus size={14} aria-hidden="true" />
      </IconButton>
    </div>
  );
}
