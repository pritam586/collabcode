import { useCallback, useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { socket } from '../socket.js';
import { applyDeltaToText, createMinimalDelta } from '../utils/monacoDeltaAdapter.js';
import { runCompiledCode } from '../utils/codeRunner.js';

const validColors = new Set(['violet', 'cyan', 'amber', 'rose', 'lime', 'sky']);

export function EditorPane({ room, syncKey, runRequest, isOutputOpen, remoteCursors, onVersionChange, onLanguageResync, onRecoveryDraft, onOutputVisibilityChange, onNotice, onRunShortcut }) {
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
  const runnerFrameRef = useRef(null);
  const lastRunRequestRef = useRef(0);
  const resizeCleanupRef = useRef(null);
  const paneRef = useRef(null);
  const [editor, setEditor] = useState(null);
  const [runnerSource, setRunnerSource] = useState('');
  const [runnerKey, setRunnerKey] = useState(0);
  const [runOutput, setRunOutput] = useState([]);
  const [outputHeight, setOutputHeight] = useState(250);

  const requestResync = useCallback(() => {
    if (room.id) socket.emit('request-resync', { roomId: room.id });
  }, [room.id]);

  const flushLocalChange = useCallback(() => {
    const model = editorRef.current?.getModel();
    if (!model || pendingDeltaRef.current || !socket.connected) return;

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

  const appendRunOutput = useCallback((type, text) => {
    setRunOutput((current) => [...current, { type, text }].slice(-60));
  }, []);

  const runCurrentCode = useCallback(() => {
    onOutputVisibilityChange(true);
    const code = editorRef.current?.getValue() || '';
    if (!code.trim()) {
      setRunOutput([{ type: 'muted', text: 'Nothing to run yet.' }]);
      return;
    }

    if (room.language === 'java' || room.language === 'cpp' || room.language === 'python' || room.language === 'typescript') {
      runNativeCode(room.language, code);
      return;
    }

    if (room.language !== 'javascript') {
      setRunOutput([{ type: 'error', text: `Run Code supports JavaScript, TypeScript, Java, Python, and C++. ${room.language} is currently editor-only.` }]);
      return;
    }

    setRunOutput([{ type: 'muted', text: 'Running JavaScript in an isolated browser sandbox…' }]);
    setRunnerSource(createRunnerDocument(code));
    setRunnerKey((current) => current + 1);
  }, [onOutputVisibilityChange, room.language]);

  async function runNativeCode(language, code) {
    const languageLabel = language === 'cpp' ? 'C++' : language === 'python' ? 'Python' : language === 'typescript' ? 'TypeScript' : 'Java';
    setRunOutput([{ type: 'muted', text: `Running ${languageLabel} in an isolated container...` }]);
    try {
      const result = await runCompiledCode(language, code);
      const output = [
        ...(result.stdout ? [{ type: 'log', text: result.stdout }] : []),
        ...(result.stderr ? [{ type: 'error', text: result.stderr }] : []),
      ];
      setRunOutput(output.length > 0 ? output : [{ type: 'muted', text: 'Program completed with no output.' }]);
    } catch (error) {
      setRunOutput([{ type: 'error', text: error.message || 'The native code runner failed.' }]);
    }
  }

  useEffect(() => {
    if (runRequest <= lastRunRequestRef.current) return;
    lastRunRequestRef.current = runRequest;
    runCurrentCode();
  }, [runRequest, runCurrentCode]);

  useEffect(() => {
    function receiveRunnerMessage(event) {
      if (event.source !== runnerFrameRef.current?.contentWindow || event.data?.source !== 'collabcode-runner') return;
      const { type, text } = event.data;
      if (type === 'done') return;
      appendRunOutput(type === 'error' ? 'error' : 'log', text);
    }

    window.addEventListener('message', receiveRunnerMessage);
    return () => window.removeEventListener('message', receiveRunnerMessage);
  }, [appendRunOutput]);

  useEffect(() => {
    if (!editor) return undefined;
    const model = editor.getModel();
    if (!model) return undefined;

    const localContent = model.getValue();
    const baseContent = authoritativeContentRef.current;
    const hasUnsyncedChanges = pendingDeltaRef.current || localContent !== baseContent;

    if (versionRef.current > room.version && localContent !== room.content) {
      // The server came back with an older copy than ours (a crash lost its latest edits, or
      // the room expired). Send our copy as an edit on top of the server's. If another
      // participant restores theirs first, the version check resyncs us onto it.
      authoritativeContentRef.current = room.content;
      versionRef.current = room.version;
      pendingDeltaRef.current = null;
      onVersionChange(room.version);
      onNotice('The server lost your latest changes, so your copy of the code was restored to the room.');
      scheduleFlush();
      return undefined;
    }

    if (hasUnsyncedChanges && localContent === room.content) {
      authoritativeContentRef.current = room.content;
      versionRef.current = room.version;
      pendingDeltaRef.current = null;
      onVersionChange(room.version);
      return undefined;
    }

    if (hasUnsyncedChanges && room.content === baseContent) {
      authoritativeContentRef.current = room.content;
      versionRef.current = room.version;
      pendingDeltaRef.current = null;
      onVersionChange(room.version);
      scheduleFlush();
      return undefined;
    }

    if (hasUnsyncedChanges) onRecoveryDraft(localContent);
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

  useEffect(() => {
    if (editor) editor.layout();
  }, [editor, isOutputOpen, outputHeight]);

  useEffect(() => () => {
    window.clearTimeout(flushTimerRef.current);
    window.clearTimeout(cursorTimerRef.current);
    resizeCleanupRef.current?.();
    mountCleanupRef.current?.();
  }, []);

  function startOutputResize(event) {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = outputHeight;

    function resize(moveEvent) {
      const paneHeight = paneRef.current?.clientHeight || 0;
      const maximumHeight = Math.max(140, paneHeight - 160);
      const nextHeight = Math.min(maximumHeight, Math.max(120, startHeight + startY - moveEvent.clientY));
      setOutputHeight(nextHeight);
    }

    function stopResize() {
      window.removeEventListener('pointermove', resize);
      window.removeEventListener('pointerup', stopResize);
      resizeCleanupRef.current = null;
    }

    resizeCleanupRef.current?.();
    resizeCleanupRef.current = stopResize;
    window.addEventListener('pointermove', resize);
    window.addEventListener('pointerup', stopResize, { once: true });
  }

  function handleMount(instance, monaco) {
    mountCleanupRef.current?.();
    editorRef.current = instance;
    monacoRef.current = monaco;
    setEditor(instance);

    const model = instance.getModel();
    if (model) monaco.editor.setModelLanguage(model, room.language);

    // Replaces Monaco's default Ctrl+Enter ("insert line below") inside the editor.
    instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRunShortcut());

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
        if (currentContent !== authoritativeContentRef.current) onRecoveryDraft(currentContent);
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
      const localContent = instance.getValue();
      const baseContent = authoritativeContentRef.current;
      const hasUnsyncedChanges = pendingDeltaRef.current || localContent !== baseContent;

      if (hasUnsyncedChanges && localContent === content) {
        authoritativeContentRef.current = content;
        versionRef.current = version;
        pendingDeltaRef.current = null;
        onVersionChange(version);
        onLanguageResync(language);
        return;
      }

      if (hasUnsyncedChanges && content === baseContent) {
        authoritativeContentRef.current = content;
        versionRef.current = version;
        pendingDeltaRef.current = null;
        onVersionChange(version);
        onLanguageResync(language);
        scheduleFlush();
        return;
      }

      if (hasUnsyncedChanges) onRecoveryDraft(localContent);
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
    <div className="editor-pane" ref={paneRef}>
      <div className="editor-surface">
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
      {isOutputOpen && (
        <section className="run-output" style={{ flexBasis: `${outputHeight}px` }} aria-live="polite" aria-label="Code output">
          <div className="output-resizer" role="separator" aria-label="Resize output panel" aria-orientation="horizontal" onPointerDown={startOutputResize} />
          <div className="run-output-heading"><span>OUTPUT</span><button type="button" onClick={() => setRunOutput([])}>Clear</button></div>
          <pre>{runOutput.length > 0 ? runOutput.map((line, index) => <code className={`output-${line.type}`} key={`${index}-${line.text}`}>{line.text}{'\n'}</code>) : <code className="output-muted">Run JavaScript to see logs and errors here.</code>}</pre>
        </section>
      )}
      {runnerSource && <iframe key={runnerKey} ref={runnerFrameRef} className="runner-frame" sandbox="allow-scripts" srcDoc={runnerSource} title="JavaScript code runner" />}
    </div>
  );
}

const RUNNER_WORKER_SOURCE = `
  const stringify = (value) => {
    if (typeof value === 'string') return value;
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
  };
  const send = (type, values = []) => postMessage({ type, text: values.map(stringify).join(' ') });
  for (const method of ['log', 'info', 'warn', 'error']) {
    console[method] = (...values) => send(method === 'error' ? 'error' : 'log', values);
  }
  self.onmessage = async ({ data }) => {
    try {
      const result = (0, eval)(data.code);
      const value = await Promise.resolve(result);
      if (value !== undefined) send('log', [value]);
    } catch (error) {
      send('error', [error?.stack || error?.message || error]);
    } finally {
      send('done');
    }
  };
`;

function createRunnerDocument(code) {
  const safelyEncodedCode = JSON.stringify(code).replace(/</g, '\\u003c');
  const safelyEncodedWorker = JSON.stringify(RUNNER_WORKER_SOURCE).replace(/</g, '\\u003c');
  return `<!doctype html><html><body><script>
    const source = 'collabcode-runner';
    const workerUrl = URL.createObjectURL(new Blob([${safelyEncodedWorker}], { type: 'text/javascript' }));
    const worker = new Worker(workerUrl);
    let completed = false;
    const closeWorker = () => {
      if (completed) return;
      completed = true;
      clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    };
    const relay = (payload) => parent.postMessage({ source, ...payload }, '*');
    const timeout = setTimeout(() => {
      relay({ type: 'error', text: 'Execution stopped after 3 seconds.' });
      relay({ type: 'done' });
      closeWorker();
    }, 3000);
    worker.onmessage = ({ data }) => {
      relay(data);
      if (data.type === 'done') closeWorker();
    };
    worker.onerror = (event) => {
      relay({ type: 'error', text: event.message || 'The JavaScript runner failed.' });
      relay({ type: 'done' });
      closeWorker();
    };
    worker.postMessage({ code: ${safelyEncodedCode} });
  <\/script></body></html>`;
}
