import { ListChecks, MessageSquare, Users, X } from 'lucide-react';
import { ChatPanel } from './ChatPanel.jsx';
import { ParticipantsPanel } from './ParticipantsPanel.jsx';
import { TasksPanel } from './TasksPanel.jsx';
import { IconButton } from './ui/Button.jsx';
import { Tabs } from './ui/Tabs.jsx';

export function Sidebar({
  selectedTab, onSelectTab, onClose, participants, selfSocketId, typingSocketIds, messages, pendingMessages,
  onSendMessage, onDiscardMessage, unreadCount, taskList, name, onInvite,
}) {
  const openTasks = taskList.tasks.filter((task) => !task.done).length;
  // The visible number is hidden from screen readers in favour of a full phrase in the tab name.
  const countBadge = (count, label, accent = false) => (count > 0 ? (
    <>
      <span className={`badge ${accent ? 'badge-accent' : ''}`} aria-hidden="true">{count}</span>
      <span className="sr-only">, {label}</span>
    </>
  ) : null);

  const tabs = [
    {
      id: 'people',
      label: 'People',
      icon: <Users size={16} aria-hidden="true" />,
      badge: countBadge(participants.length, `${participants.length} in the room`),
      content: <ParticipantsPanel participants={participants} selfSocketId={selfSocketId} typingSocketIds={typingSocketIds} onInvite={onInvite} />,
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: <MessageSquare size={16} aria-hidden="true" />,
      badge: countBadge(unreadCount, `${unreadCount} unread`, true),
      content: <ChatPanel messages={messages} pendingMessages={pendingMessages} selfSocketId={selfSocketId} onSend={onSendMessage} onDiscard={onDiscardMessage} isVisible={selectedTab === 'chat'} />,
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: <ListChecks size={16} aria-hidden="true" />,
      badge: countBadge(openTasks, `${openTasks} open`),
      content: <TasksPanel taskList={taskList} name={name} />,
    },
  ];

  return (
    <aside className="sidebar" id="workspace-sidebar" aria-label="People, chat and tasks">
      <div className="sidebar-close">
        <IconButton label="Close sidebar" size="sm" onClick={onClose}><X size={16} aria-hidden="true" /></IconButton>
      </div>
      <Tabs label="Sidebar" tabs={tabs} selectedId={selectedTab} onSelect={onSelectTab} />
    </aside>
  );
}
