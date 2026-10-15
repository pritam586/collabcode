import { useCallback, useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import '../editor/monacoSetup.js';
import { bindMonacoToYText } from '../collab/monacoBinding.js';
import { bindRemoteCursors } from '../collab/remoteCursors.js';
import { EditorKeyBar } from './EditorKeyBar.jsx';
import { MOD_KEY } from './ui/Kbd.jsx';
import { TOUCH_QUERY, useMediaQuery } from '../hooks/useMediaQuery.js';
import { runCompiledCode } from '../utils/codeRunner.js';

// Binds Monaco to the room's shared Yjs document (the provider is owned by App) and runs code.
// view: 'split' shows the editor with an optional output panel below (isOutputOpen); on
// phones 'code' and 'output' show one of them full height. The editor stays mounted either way.
export function EditorPane({ room, provider, runRequest, view = 'split', isOutputOpen, onOutputVisibilityChange, onRunShortcut, theme = 'dark', fontSize = 14 }) {
  const isTouch = useMediaQuery(TOUCH_QUERY);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const runnerFrameRef = useRef(null);
  const lastRunRequestRef = useRef(0);
  const resizeCleanupRef = useRef(null);
  const paneRef = useRef(null);
  const [editor, setEditor] = useState(null);
  const [isSynced, setIsSynced] = useState(provider.synced);
  const [runnerSource, setRunnerSource] = useState('');
  const [runnerKey, setRunnerKey] = useState(0);
  const [runOutput, setRunOutput] = useState([]);
  const [outputHeight, setOutputHeight] = useState(250);

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
    setIsSynced(provider.synced);
    return provider.on('synced', () => setIsSynced(true));
  }, [provider]);

  useEffect(() => {
    if (!editor || !monacoRef.current) return undefined;
    const monaco = monacoRef.current;
    const cursors = bindRemoteCursors({ provider, editor, monaco });
    const binding = bindMonacoToYText({ ytext: provider.text, editor, monaco, onLocalChange: cursors.markTyping });
    return () => {
      cursors.destroy();
      binding.destroy();
    };
  }, [editor, provider]);

  useEffect(() => {
    const model = editor?.getModel();
    if (model && monacoRef.current) monacoRef.current.editor.setModelLanguage(model, room.language);
  }, [editor, room.language]);

  useEffect(() => {
    if (editor) editor.layout();
  }, [editor, isOutputOpen, outputHeight, view]);

  const showEditor = view !== 'output';
  const showOutput = view === 'output' || (view === 'split' && isOutputOpen);

  useEffect(() => () => resizeCleanupRef.current?.(), []);

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
    editorRef.current = instance;
    monacoRef.current = monaco;
    setEditor(instance);

    const model = instance.getModel();
    if (model) monaco.editor.setModelLanguage(model, room.language);

    // Replaces Monaco's default Ctrl+Enter ("insert line below") inside the editor.
    instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRunShortcut());
  }

  return (
    <div className={`editor-pane view-${view}`} ref={paneRef}>
      <div className="editor-surface" aria-busy={!isSynced} hidden={!showEditor}>
        {!isSynced && (
          <div className="editor-loading" role="status">
            <div className="editor-loading-lines" aria-hidden="true">
              {[64, 42, 78, 30, 56].map((width, index) => <span key={index} className="skeleton skeleton-line" style={{ width: `${width}%` }} />)}
            </div>
            <p><span className="spinner" aria-hidden="true" /> Loading the shared code…</p>
          </div>
        )}
        <Editor
          height="100%"
          defaultLanguage={room.language}
          theme={theme === 'light' ? 'vs' : 'vs-dark'}
          loading={<span className="sr-only">Loading the editor…</span>}
          onMount={handleMount}
          options={{
            automaticLayout: true,
            ariaLabel: 'Shared code editor. Press Alt+F1 for editor accessibility help.',
            fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
            fontSize,
            lineHeight: Math.round(fontSize * 1.7),
            minimap: { enabled: false },
            padding: { top: isTouch ? 12 : 18, bottom: 18 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorSmoothCaretAnimation: 'on',
            renderLineHighlight: 'all',
            tabSize: 2,
            // Touch screens: wrap long lines instead of scrolling sideways, drop the margins that
            // waste width, and use scrollbars large enough to grab with a finger.
            wordWrap: isTouch ? 'on' : 'off',
            folding: !isTouch,
            glyphMargin: false,
            lineNumbersMinChars: isTouch ? 2 : 4,
            scrollbar: { verticalScrollbarSize: isTouch ? 14 : 12, horizontalScrollbarSize: isTouch ? 14 : 12, alwaysConsumeMouseWheel: false },
            // Typing before the shared code arrives would merge with it in surprising ways.
            readOnly: !isSynced,
          }}
        />
      </div>
      {isTouch && showEditor && editor && isSynced && <EditorKeyBar editor={editor} />}
      {showOutput && (
        <section className="run-output" style={view === 'split' ? { flexBasis: `${outputHeight}px` } : undefined} aria-live="polite" aria-label="Code output">
          {view === 'split' && <div className="output-resizer" role="separator" aria-label="Resize output panel" aria-orientation="horizontal" onPointerDown={startOutputResize} />}
          <div className="run-output-heading">
            <h2>Output</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRunOutput([])} disabled={runOutput.length === 0}>Clear</button>
          </div>
          <pre>{runOutput.length > 0 ? runOutput.map((line, index) => <code className={`output-${line.type}`} key={`${index}-${line.text}`}>{line.text}{'\n'}</code>) : <code className="output-muted">Press Run or {MOD_KEY}+Enter to run the code. Output and errors appear here.</code>}</pre>
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
