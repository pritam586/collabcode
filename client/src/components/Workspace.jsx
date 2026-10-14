import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorPane } from './EditorPane.jsx';
import { OnboardingTour } from './OnboardingTour.jsx';
import { ShareDialog } from './ShareDialog.jsx';
import { ShortcutsDialog } from './ShortcutsDialog.jsx';
import { Sidebar } from './Sidebar.jsx';
import { StatusBar } from './StatusBar.jsx';
import { WorkspaceHeader } from './WorkspaceHeader.jsx';
import { useToast } from './ui/Toast.jsx';
import { usePresence, useTasks } from '../hooks/useCollaboration.js';
import { useFontSize } from '../hooks/usePreferences.js';
import { getFileExtension } from '../constants/languages.js';
import { roomUrl } from '../lib/rooms.js';
import { readStorage, writeStorage } from '../lib/storage.js';

const SIDEBAR_KEY = 'collabcode-sidebar-open';

export function Workspace({ roomId, name, session, navigate, themeControls }) {
  const toast = useToast();
  const [fontSize, setFontSize] = useFontSize();
  const [runRequest, setRunRequest] = useState(0);
  const [isOutputOpen, setIsOutputOpen] = useState(false);
  const [sidebarOpen, setSidebarOpenState] = useState(() => readStorage(SIDEBAR_KEY, window.innerWidth >= 900));
  const [sidebarTab, setSidebarTab] = useState('people');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [lastSeenMessageId, setLastSeenMessageId] = useState(() => session.messages.at(-1)?.id ?? 0);
  const typingSocketIds = usePresence(session.provider);
  const taskList = useTasks(session.provider);
  const editorRegionRef = useRef(null);

  const setSidebarOpen = useCallback((open) => {
    setSidebarOpenState(open);
    writeStorage(SIDEBAR_KEY, open);
  }, []);

  const run = useCallback(() => setRunRequest((value) => value + 1), []);

  // Chat counts as read while the chat tab is visible.
  const chatVisible = sidebarOpen && sidebarTab === 'chat';
  const latestMessageId = session.messages.at(-1)?.id ?? 0;
  useEffect(() => {
    if (chatVisible) setLastSeenMessageId(latestMessageId);
  }, [chatVisible, latestMessageId]);
  const unreadCount = chatVisible ? 0 : session.messages.filter((message) => message.id > lastSeenMessageId && message.author?.socketId !== session.selfSocketId).length;

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
      const typingInField = event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"], .monaco-editor');
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
  const typingNames = session.participants.filter((person) => typingSocketIds.has(person.socketId)).map((person) => person.name);

  return (
    <div className={`workspace ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <a className="skip-link" href="#editor-region" onClick={() => editorRegionRef.current?.querySelector('textarea')?.focus()}>Skip to the editor</a>
      <WorkspaceHeader
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
        <main className="editor-column" id="editor-region" ref={editorRegionRef} aria-label="Code editor">
          <div className="file-tab"><span className={`file-dot file-dot-${session.language}`} aria-hidden="true" /> untitled.{getFileExtension(session.language)}</div>
          <EditorPane
            key={roomId}
            room={room}
            provider={session.provider}
            runRequest={runRequest}
            isOutputOpen={isOutputOpen}
            onOutputVisibilityChange={setIsOutputOpen}
            onRunShortcut={run}
            theme={themeControls.theme}
            fontSize={fontSize}
          />
          <StatusBar status={session.status} typingNames={typingNames} language={session.language} fontSize={fontSize} />
        </main>

        {sidebarOpen && (
          <Sidebar
            selectedTab={sidebarTab}
            onSelectTab={setSidebarTab}
            onClose={() => setSidebarOpen(false)}
            participants={session.participants}
            selfSocketId={session.selfSocketId}
            typingSocketIds={typingSocketIds}
            messages={session.messages}
            pendingMessages={session.pendingMessages}
            onSendMessage={session.sendMessage}
            onDiscardMessage={session.discardMessage}
            unreadCount={unreadCount}
            taskList={taskList}
            name={name}
            onInvite={share}
          />
        )}
      </div>

      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <ShareDialog open={shareOpen} roomId={roomId} onClose={() => setShareOpen(false)} />
      <OnboardingTour onOpenSidebar={() => setSidebarOpen(true)} />
    </div>
  );
}
