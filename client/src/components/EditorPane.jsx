import { useCallback, useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { socket } from '../socket.js';
import { applyDeltaToText, createMinimalDelta } from '../utils/monacoDeltaAdapter.js';

const validColors = new Set(['violet', 'cyan', 'amber', 'rose', 'lime', 'sky']);

export function EditorPane({ room, syncKey, remoteCursors, onVersionChange, onLanguageResync, onNotice }) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const authoritativeContentRef = useRef(room.content);
  const versionRef = useRef(room.version);
  const pendingDeltaRef = useRef(null);
  const isRemoteChangeRef = useRef(false);
  const flushTimerRef = useRef(null);
  const cursorTimerRef = useRef(null);
  const latestSelectionRef = useRef(null);
  const decorationIdsRef = useRef([]);
  const mountCleanupRef = useRef(null);
  const [editor, setEditor] = useState(null);

  const requestResync = useCallback(() => {
    if (room.id) socket.emit('request-resync', { roomId: room.id });
  }, [room.id]);

  const flushLocalChange = useCallback(() => {
    const model = editorRef.current?.getModel();
    if (!model || pendingDeltaRef.current) return;

    const currentContent = model.getValue();
    const delta = createMinimalDelta(authoritativeContentRef.current, currentContent);
    if (!delta) return;

    pendingDeltaRef.current = delta;
    socket.emit('code-change', { roomId: room.id, delta, version: versionRef.current });
  }, [room.id]);

  const scheduleFlush = useCallback(() => {
    window.clearTimeout(flushTimerRef.current);
    flushTimerRef.current = window.setTimeout(flushLocalChange, 140);
  }, [flushLocalChange]);

  useEffect(() => {
    if (!editor) return undefined;
    const model = editor.getModel();
    if (!model) return undefined;

    isRemoteChangeRef.current = true;
    model.setValue(room.content);
    isRemoteChangeRef.current = false;
    authoritativeContentRef.current = room.content;
    versionRef.current = room.version;
    pendingDeltaRef.current = null;
    onVersionChange(room.version);

    return undefined;
  // A changed sync key always means the server sent us a new authoritative snapshot.
  }, [syncKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const model = editor?.getModel();
    if (model && monacoRef.current) monacoRef.current.editor.setModelLanguage(model, room.language);
  }, [editor, room.language]);

  useEffect(() => {
    if (!editor || !monacoRef.current) return undefined;
    const nextDecorations = Object.values(remoteCursors).map((cursor) => {
      const color = validColors.has(cursor.color) ? cursor.color : 'violet';
      return {
        range: new monacoRef.current.Range(
          cursor.position.startLineNumber,
          cursor.position.startColumn,
          cursor.position.endLineNumber,
          cursor.position.endColumn,
        ),
        options: {
          className: `remote-selection remote-selection-${color}`,
          beforeContentClassName: `remote-cursor-marker remote-cursor-${color}`,
          after: { content: ` ${cursor.name}`, inlineClassName: `remote-cursor-tag remote-tag-${color}` },
          hoverMessage: { value: `${cursor.name}'s selection` },
        },
      };
    });
    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, nextDecorations);
    return undefined;
  }, [editor, remoteCursors]);

  useEffect(() => () => {
    window.clearTimeout(flushTimerRef.current);
    window.clearTimeout(cursorTimerRef.current);
    mountCleanupRef.current?.();
  }, []);

  function handleMount(instance, monaco) {
    mountCleanupRef.current?.();
    editorRef.current = instance;
    monacoRef.current = monaco;
    setEditor(instance);

    const model = instance.getModel();
    if (model) monaco.editor.setModelLanguage(model, room.language);

    const changeSubscription = instance.onDidChangeModelContent(() => {
      if (!isRemoteChangeRef.current) scheduleFlush();
    });

    const cursorSubscription = instance.onDidChangeCursorSelection((event) => {
      latestSelectionRef.current = {
        startLineNumber: event.selection.startLineNumber,
        startColumn: event.selection.startColumn,
        endLineNumber: event.selection.endLineNumber,
        endColumn: event.selection.endColumn,
      };
      window.clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = window.setTimeout(() => {
        socket.emit('cursor-update', { roomId: room.id, position: latestSelectionRef.current });
      }, 45);
    });

    function handleAccepted({ version }) {
      const delta = pendingDeltaRef.current;
      if (!delta) return;

      const updated = applyDeltaToText(authoritativeContentRef.current, delta);
      if (updated === null) {
        requestResync();
        return;
      }
      authoritativeContentRef.current = updated;
      versionRef.current = version;
      pendingDeltaRef.current = null;
      onVersionChange(version);
      scheduleFlush();
    }

    function handleRemoteChange({ delta, version }) {
      const currentContent = instance.getValue();
      if (
        pendingDeltaRef.current ||
        currentContent !== authoritativeContentRef.current ||
        version !== versionRef.current + 1
      ) {
        requestResync();
        return;
      }

      const updated = applyDeltaToText(authoritativeContentRef.current, delta);
      if (updated === null) {
        requestResync();
        return;
      }

      isRemoteChangeRef.current = true;
      instance.getModel().applyEdits([{ range: delta.range, text: delta.text }]);
      isRemoteChangeRef.current = false;
      authoritativeContentRef.current = updated;
      versionRef.current = version;
      onVersionChange(version);
    }

    function handleResync({ content, version, language }) {
      window.clearTimeout(flushTimerRef.current);
      pendingDeltaRef.current = null;
      isRemoteChangeRef.current = true;
      instance.getModel().setValue(content);
      isRemoteChangeRef.current = false;
      authoritativeContentRef.current = content;
      versionRef.current = version;
      onVersionChange(version);
      onLanguageResync(language);
      onNotice('Your editor was refreshed from the shared version.');
    }

    function handleDocumentError({ message }) {
      onNotice(message);
    }

    socket.on('change-accepted', handleAccepted);
    socket.on('remote-change', handleRemoteChange);
    socket.on('force-resync', handleResync);
    socket.on('document-error', handleDocumentError);

    mountCleanupRef.current = () => {
      changeSubscription.dispose();
      cursorSubscription.dispose();
      socket.off('change-accepted', handleAccepted);
      socket.off('remote-change', handleRemoteChange);
      socket.off('force-resync', handleResync);
      socket.off('document-error', handleDocumentError);
    };
  }

  return (
    <div className="editor-pane">
      <Editor
        height="100%"
        defaultLanguage={room.language}
        defaultValue={room.content}
        theme="vs-dark"
        onMount={handleMount}
        options={{
          automaticLayout: true,
          fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
          fontSize: 14,
          lineHeight: 24,
          minimap: { enabled: false },
          padding: { top: 18, bottom: 18 },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorSmoothCaretAnimation: 'on',
          renderLineHighlight: 'all',
          tabSize: 2,
        }}
      />
    </div>
  );
}
