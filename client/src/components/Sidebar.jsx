import { X } from 'lucide-react';
import { IconButton } from './ui/Button.jsx';
import { Tabs } from './ui/Tabs.jsx';

// Desktop and tablet sidebar. `sections` comes from Workspace (useRoomSections), which also
// feeds the phone layout's bottom tabs, so both show the same panels and badges.
export function Sidebar({ sections, selectedTab, onSelectTab, onClose }) {
  const tabs = sections.map(({ id, label, icon: Icon, badge, content }) => ({
    id,
    label,
    icon: <Icon size={16} aria-hidden="true" />,
    badge: <CountBadge {...badge} />,
    content,
  }));

  return (
    <aside className="sidebar" id="workspace-sidebar" aria-label="People, chat and tasks">
      <div className="sidebar-close">
        <IconButton label="Close sidebar" size="sm" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </IconButton>
      </div>
      <Tabs label="Sidebar" tabs={tabs} selectedId={selectedTab} onSelect={onSelectTab} />
    </aside>
  );
}

// The visible number is hidden from screen readers in favour of a full phrase in the tab name.
export function CountBadge({ count = 0, label = '', accent = false }) {
  if (count <= 0) return null;
  return (
    <>
      <span className={`badge ${accent ? 'badge-accent' : ''}`} aria-hidden="true">
        {count}
      </span>
      <span className="sr-only">, {label}</span>
    </>
  );
}
