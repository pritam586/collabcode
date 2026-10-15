import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Code2, ListChecks, MessageSquare, SquareTerminal, Users } from 'lucide-react';
import { ChatPanel } from './ChatPanel.jsx';
import { MobileNav } from './MobileNav.jsx';
import { OnboardingTour } from './OnboardingTour.jsx';
import { ParticipantsPanel } from './ParticipantsPanel.jsx';
import { ShareDialog } from './ShareDialog.jsx';
import { ShortcutsDialog } from './ShortcutsDialog.jsx';
import { Sidebar } from './Sidebar.jsx';
import { StatusBar } from './StatusBar.jsx';
import { TasksPanel } from './TasksPanel.jsx';
import { WorkspaceHeader } from './WorkspaceHeader.jsx';
import { useToast } from './ui/useToast.js';
import { usePresence, useTasks } from '../hooks/useCollaboration.js';
import { COMPACT_QUERY, useMediaQuery } from '../hooks/useMediaQuery.js';
import { useFontSize } from '../hooks/usePreferences.js';
import { getFileExtension } from '../constants/languages.js';
import { roomUrl } from '../lib/rooms.js';
import { readStorage, writeStorage } from '../lib/storage.js';

const SIDEBAR_KEY = 'collabcode-sidebar-open';
// Monaco is the heaviest part of the app; the toolbar, people and chat appear while it loads.
const EditorPane = lazy(() => import('./EditorPane.jsx').then((module) => ({ default: module.EditorPane })));

// Two layouts share the same state and panels:
// - phones (COMPACT_QUERY): one view at a time, picked from a bottom tab bar;
// - tablets and desktops: editor with an optional output split and a sidebar (an overlay
//   drawer below 1024px, side by side above).
export function Workspace({ roomId, name, session, navigate, themeControls }) {
  const toast = useToast();
  const compact = useMediaQuery(COMPACT_QUERY);
  const [fontSize, setFontSize] = useFontSize();
  const [runRequest, setRunRequest] = useState(0);
  const [isOutputOpen, setIsOutputOpen] = useState(false);
  // Below 1024px the sidebar covers the editor, so it starts closed there; the remembered
  // choice only applies on screens wide enough to show both.
  const isWide = () => window.innerWidth >= 1024;
  const [sidebarOpen, setSidebarOpenState] = useState(() => isWide() && readStorage(SIDEBAR_KEY, true));
  const [sidebarTab, setSidebarTab] = useState('people');
  const [mobileView, setMobileView] = useState('code');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [lastSeenMessageId, setLastSeenMessageId] = useState(() => session.messages.at(-1)?.id ?? 0);
  const typingSocketIds = usePresence(session.provider);
  const taskList = useTasks(session.provider);
  const editorRegionRef = useRef(null);

  const setSidebarOpen = useCallback((open) => {
    setSidebarOpenState(open);
    if (isWide()) writeStorage(SIDEBAR_KEY, open);
  }, []);

  const run = useCallback(() => setRunRequest((value) => value + 1), []);
  // Running code reveals its output: the split panel on wide screens, the Output view on phones.
  const showOutput = useCallback(
    (visible) => {
      if (compact) {
        if (visible) setMobileView('output');
      } else {
        setIsOutputOpen(visible);
      }
    },
    [compact],
  );

  // Chat counts as read while it is on screen.
  const chatVisible = compact ? mobileView === 'chat' : sidebarOpen && sidebarTab === 'chat';
  const latestMessageId = session.messages.at(-1)?.id ?? 0;
  // Adjusting state during render (not in an effect) avoids a second render pass:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (chatVisible && lastSeenMessageId !== latestMessageId) setLastSeenMessageId(latestMessageId);
  const unreadCount = chatVisible
    ? 0
    : session.messages.filter(
        (message) => message.id > lastSeenMessageId && message.author?.socketId !== session.selfSocketId,
      ).length;

  const share = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomUrl(roomId));
      toast.success('Invite link copied. Send it to anyone you want to code with.');
    } catch {
      // Clipboard access can be blocked (insecure origin, permissions). Show the link instead.
      setShareOpen(true);
    }
  }, [roomId, toast]);

  // Global shortcuts. Monaco handles Ctrl/Cmd+Enter itself while it has focus.
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.defaultPrevented) return;
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        run();
        return;
      }
      const typingInField =
        event.target instanceof HTMLElement &&
        event.target.closest('input, textarea, select, [contenteditable="true"], .monaco-editor');
      const isQuestionMark = event.key === '?' || (event.code === 'Slash' && event.shiftKey);
      if (isQuestionMark && !typingInField) {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [run]);

  const room = useMemo(() => ({ id: roomId, language: session.language }), [roomId, session.language]);
  const typingNames = session.participants
    .filter((person) => typingSocketIds.has(person.socketId))
    .map((person) => person.name);
  const openTasks = taskList.tasks.filter((task) => !task.done).length;
  const peopleCount = session.participants.length;

  const sections = [
    {
      id: 'people',
      label: 'People',
      icon: Users,
      badge: { count: peopleCount, label: `${peopleCount} in the room` },
      content: (
        <ParticipantsPanel
          participants={session.participants}
          selfSocketId={session.selfSocketId}
          typingSocketIds={typingSocketIds}
          onInvite={share}
        />
      ),
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: MessageSquare,
      badge: { count: unreadCount, label: `${unreadCount} unread`, accent: true },
      content: (
        <ChatPanel
          messages={session.messages}
          pendingMessages={session.pendingMessages}
          selfSocketId={session.selfSocketId}
          onSend={session.sendMessage}
          onDiscard={session.discardMessage}
          isVisible={chatVisible}
        />
      ),
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: ListChecks,
      badge: { count: openTasks, label: `${openTasks} open` },
      content: <TasksPanel taskList={taskList} name={name} />,
    },
  ];

  const editorView = compact ? (mobileView === 'output' ? 'output' : 'code') : 'split';
  const editorVisible = !compact || mobileView === 'code' || mobileView === 'output';

  return (
    <div className={`workspace ${compact ? 'is-compact' : ''} ${sidebarOpen && !compact ? 'sidebar-open' : ''}`}>
      <a
        className="skip-link"
        href="#editor-region"
        onClick={() => editorRegionRef.current?.querySelector('textarea')?.focus()}
      >
        Skip to the editor
      </a>
      <WorkspaceHeader
        compact={compact}
        roomId={roomId}
        status={session.status}
        language={session.language}
        onLanguageChange={session.changeLanguage}
        onRun={run}
        isOutputOpen={isOutputOpen}
        onToggleOutput={() => setIsOutputOpen((open) => !open)}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        themeControls={themeControls}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onShare={share}
        onShowShortcuts={() => setShortcutsOpen(true)}
        onLeave={() => navigate('/')}
        participants={session.participants}
        unreadCount={unreadCount}
      />

      <div className="workspace-body">
        <main
          className="editor-column"
          id="editor-region"
          ref={editorRegionRef}
          aria-label="Code editor"
          hidden={!editorVisible}
        >
          <div className="file-tab">
            <span className={`file-dot file-dot-${session.language}`} aria-hidden="true" /> untitled.
            {getFileExtension(session.language)}
          </div>
          <Suspense fallback={<EditorFallback />}>
            <EditorPane
              key={roomId}
              room={room}
              provider={session.provider}
              runRequest={runRequest}
              view={editorView}
              isOutputOpen={isOutputOpen}
              onOutputVisibilityChange={showOutput}
              onRunShortcut={run}
              theme={themeControls.theme}
              fontSize={fontSize}
            />
          </Suspense>
          <StatusBar
            status={session.status}
            typingNames={typingNames}
            language={session.language}
            fontSize={fontSize}
          />
        </main>

        {compact
          ? sections.map((section) => (
              <section
                key={section.id}
                id={`mobile-panel-${section.id}`}
                className="mobile-panel"
                role="tabpanel"
                aria-label={section.label}
                hidden={mobileView !== section.id}
              >
                {section.content}
              </section>
            ))
          : sidebarOpen && (
              <Sidebar
                sections={sections}
                selectedTab={sidebarTab}
                onSelectTab={setSidebarTab}
                onClose={() => setSidebarOpen(false)}
              />
            )}
      </div>

      {compact && (
        <MobileNav
          selectedId={mobileView}
          onSelect={setMobileView}
          items={[
            { id: 'code', label: 'Code', icon: Code2, controls: 'editor-region' },
            { id: 'output', label: 'Output', icon: SquareTerminal, controls: 'editor-region' },
            ...['chat', 'tasks', 'people'].map((id) => {
              const section = sections.find((item) => item.id === id);
              return {
                id,
                label: section.label,
                icon: section.icon,
                badge: section.badge,
                controls: `mobile-panel-${id}`,
              };
            }),
          ]}
        />
      )}

      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <ShareDialog open={shareOpen} roomId={roomId} onClose={() => setShareOpen(false)} />
      <OnboardingTour
        onOpenSidebar={() => {
          if (!compact) setSidebarOpen(true);
        }}
      />
    </div>
  );
}

function EditorFallback() {
  return (
    <div className="editor-pane">
      <div className="editor-surface">
        <div className="editor-loading" role="status">
          <div className="editor-loading-lines" aria-hidden="true">
            {[64, 42, 78, 30, 56].map((width, index) => (
              <span key={index} className="skeleton skeleton-line" style={{ width: `${width}%` }} />
            ))}
          </div>
          <p>
            <span className="spinner" aria-hidden="true" /> Loading the editor…
          </p>
        </div>
      </div>
    </div>
  );
}
