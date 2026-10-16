import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Editor from '@monaco-editor/react';
import { CircleCheck, CircleX, Eraser, SquareTerminal, X } from 'lucide-react';
import '../editor/monacoSetup.js';
import { EDITOR_THEMES } from '../editor/themes.js';
import { bindMonacoToYText } from '../collab/monacoBinding.js';
import { bindRemoteCursors } from '../collab/remoteCursors.js';
import { EditorKeyBar } from './EditorKeyBar.jsx';
import { Button, IconButton } from './ui/Button.jsx';
import { Badge } from './ui/Feedback.jsx';
import { ResizeHandle } from './ui/ResizeHandle.jsx';
import { Spinner } from './ui/Spinner.jsx';
import { LANGUAGES, getRunCommand } from '../constants/languages.js';
import { readStorage, writeStorage } from '../lib/storage.js';
import { MOD_KEY } from '../lib/platform.js';
import { TOUCH_QUERY, useMediaQuery } from '../hooks/useMediaQuery.js';
import { runCompiledCode } from '../utils/codeRunner.js';

// Binds Monaco to the room's shared Yjs document (the provider is owned by App) and runs code.
// view: 'split' shows the editor with an optional console below (isOutputOpen); on phones
// 'code' and 'output' show one of them full height. The editor stays mounted either way.
export function EditorPane({
  room,
  provider,
  runRequest,
  view = 'split',
  isOutputOpen,
  onOutputVisibilityChange,
  onRunShortcut,
  theme = 'dark',
  fontSize = 14,
}) {
  const isTouch = useMediaQuery(TOUCH_QUERY);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const runnerFrameRef = useRef(null);
  const lastRunRequestRef = useRef(0);
  const runHadErrorRef = useRef(false);
  const paneRef = useRef(null);
  const [editor, setEditor] = useState(null);
  const subscribeToSync = useCallback((onChange) => provider.on('synced', onChange), [provider]);
  const isSynced = useSyncExternalStore(subscribeToSync, () => provider.synced);
  const [runnerSource, setRunnerSource] = useState('');
  const [runnerKey, setRunnerKey] = useState(0);
  const [runOutput, setRunOutput] = useState([]);
  // { status: 'running' | 'success' | 'error', language, startedAt, duration?, exitCode? }
  const [run, setRun] = useState(null);
  const [outputHeight, setOutputHeightState] = useState(() => readStorage(OUTPUT_HEIGHT_KEY, DEFAULT_OUTPUT_HEIGHT));
  const [paneHeight, setPaneHeight] = useState(0);

  const setOutputHeight = useCallback((height) => {
    setOutputHeightState(height);
    writeStorage(OUTPUT_HEIGHT_KEY, height);
  }, []);

  const appendRunOutput = useCallback((type, text) => {
    if (type === 'error') runHadErrorRef.current = true;
    setRunOutput((current) => [...current, { type, text }].slice(-200));
  }, []);

  const finishRun = useCallback((status, details = {}) => {
    setRun((current) =>
      current?.status === 'running'
        ? { ...current, status, duration: performance.now() - current.startedAt, ...details }
        : current,
    );
  }, []);

  const runNativeCode = useCallback(
    async (language, code) => {
      const languageLabel = LANGUAGES.find(([value]) => value === language)?.[1] ?? language;
      setRunOutput([{ type: 'muted', text: `Running ${languageLabel} in an isolated container…` }]);
      try {
        const result = await runCompiledCode(language, code);
        const output = [
          ...(result.stdout ? [{ type: 'log', text: result.stdout }] : []),
          ...(result.stderr ? [{ type: 'error', text: result.stderr }] : []),
        ];
        setRunOutput(output.length > 0 ? output : [{ type: 'muted', text: 'Program completed with no output.' }]);
        const exitCode = result.exitCode ?? (result.stderr ? 1 : 0);
        finishRun(exitCode === 0 ? 'success' : 'error', { exitCode });
      } catch (error) {
        setRunOutput([{ type: 'error', text: error.message || 'The native code runner failed.' }]);
        finishRun('error');
      }
    },
    [finishRun],
  );

  const runCurrentCode = useCallback(() => {
    onOutputVisibilityChange(true);
    const code = editorRef.current?.getValue() || '';
    if (!code.trim()) {
      setRun(null);
      setRunOutput([{ type: 'muted', text: 'Nothing to run yet. Write some code first.' }]);
      return;
    }
    if (!RUNNABLE.has(room.language)) {
      setRun(null);
      setRunOutput([
        {
          type: 'error',
          text: `Run supports JavaScript, TypeScript, Python, Java and C++. ${room.language} is editor-only.`,
        },
      ]);
      return;
    }

    runHadErrorRef.current = false;
    setRun({ status: 'running', language: room.language, startedAt: performance.now() });
    if (room.language !== 'javascript') {
      runNativeCode(room.language, code);
      return;
    }
    setRunOutput([]);
    setRunnerSource(createRunnerDocument(code));
    setRunnerKey((current) => current + 1);
  }, [onOutputVisibilityChange, room.language, runNativeCode]);

  useEffect(() => {
    if (runRequest <= lastRunRequestRef.current) return;
    lastRunRequestRef.current = runRequest;
    runCurrentCode();
  }, [runRequest, runCurrentCode]);

  useEffect(() => {
    function receiveRunnerMessage(event) {
      if (event.source !== runnerFrameRef.current?.contentWindow || event.data?.source !== 'collabcode-runner') return;
      const { type, text } = event.data;
      if (type === 'done') finishRun(runHadErrorRef.current ? 'error' : 'success');
      else appendRunOutput(type === 'error' ? 'error' : 'log', text);
    }

    window.addEventListener('message', receiveRunnerMessage);
    return () => window.removeEventListener('message', receiveRunnerMessage);
  }, [appendRunOutput, finishRun]);

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

  // The console may take at most the pane's height minus room for a few lines of code.
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setPaneHeight(entry.contentRect.height));
    observer.observe(pane);
    return () => observer.disconnect();
  }, []);

  const showEditor = view !== 'output';
  const showOutput = view === 'output' || (view === 'split' && isOutputOpen);
  const maxOutputHeight = Math.max(MIN_OUTPUT_HEIGHT, paneHeight - 160);
  const consoleHeight = paneHeight ? Math.min(outputHeight, maxOutputHeight) : outputHeight;

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
              {[64, 42, 78, 30, 56].map((width, index) => (
                <span key={index} className="skeleton skeleton-line" style={{ width: `${width}%` }} />
              ))}
            </div>
            <p>
              <span className="spinner" aria-hidden="true" /> Loading the shared code…
            </p>
          </div>
        )}
        <Editor
          height="100%"
          defaultLanguage={room.language}
          theme={EDITOR_THEMES[theme] ?? EDITOR_THEMES.dark}
          loading={<span className="sr-only">Loading the editor…</span>}
          onMount={handleMount}
          options={{
            automaticLayout: true,
            ariaLabel: 'Shared code editor. Press Alt+F1 for editor accessibility help.',
            fontFamily: "'JetBrains Mono Variable', 'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
            fontLigatures: true,
            fontSize,
            lineHeight: Math.round(fontSize * 1.7),
            minimap: { enabled: false },
            padding: { top: isTouch ? 12 : 18, bottom: 18 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorSmoothCaretAnimation: 'on',
            cursorBlinking: 'smooth',
            cursorWidth: 2,
            guides: { indentation: true, bracketPairs: false },
            renderLineHighlight: 'all',
            roundedSelection: true,
            tabSize: 2,
            // Touch screens: wrap long lines instead of scrolling sideways, drop the margins that
            // waste width, and use scrollbars large enough to grab with a finger.
            wordWrap: isTouch ? 'on' : 'off',
            folding: !isTouch,
            glyphMargin: false,
            lineNumbersMinChars: isTouch ? 2 : 4,
            scrollbar: {
              verticalScrollbarSize: isTouch ? 14 : 10,
              horizontalScrollbarSize: isTouch ? 14 : 10,
              alwaysConsumeMouseWheel: false,
            },
            // Typing before the shared code arrives would merge with it in surprising ways.
            readOnly: !isSynced,
          }}
        />
      </div>
      {isTouch && showEditor && editor && isSynced && <EditorKeyBar editor={editor} />}
      {showOutput && (
        <section
          className="console"
          id="code-output"
          style={view === 'split' ? { flexBasis: `${consoleHeight}px` } : undefined}
          aria-label="Code output"
        >
          {view === 'split' && (
            <ResizeHandle
              label="Resize output panel"
              orientation="horizontal"
              value={consoleHeight}
              min={MIN_OUTPUT_HEIGHT}
              max={maxOutputHeight}
              invert
              controls="code-output"
              onChange={setOutputHeight}
              onReset={() => setOutputHeight(DEFAULT_OUTPUT_HEIGHT)}
            />
          )}
          <div className="console-header">
            <h2 className="console-title">
              <SquareTerminal size={14} aria-hidden="true" />
              Output
            </h2>
            <RunStatus run={run} />
            <div className="console-actions">
              <Button
                variant="ghost"
                size="sm"
                icon={<Eraser size={14} aria-hidden="true" />}
                onClick={() => {
                  setRunOutput([]);
                  setRun(null);
                }}
                disabled={runOutput.length === 0 && !run}
              >
                Clear
              </Button>
              {view === 'split' && (
                <IconButton label="Close output panel" size="sm" onClick={() => onOutputVisibilityChange(false)}>
                  <X size={14} aria-hidden="true" />
                </IconButton>
              )}
            </div>
          </div>
          <pre className="console-body" aria-live="polite">
            {run && (
              <code className="console-line console-command">
                <span className="console-prompt" aria-hidden="true">
                  ❯
                </span>{' '}
                {getRunCommand(run.language)}
                {'\n'}
              </code>
            )}
            {runOutput.length > 0
              ? runOutput.map((line, index) => (
                  <code className={`console-line output-${line.type}`} key={`${index}-${line.text}`}>
                    {line.text}
                    {'\n'}
                  </code>
                ))
              : !run && (
                  <code className="console-line output-muted">
                    Press Run or {MOD_KEY}+Enter to run the code. Output and errors appear here.
                  </code>
                )}
            {run && run.status !== 'running' && (
              <code className={`console-line console-exit is-${run.status}`}>
                {run.status === 'success' ? (
                  <CircleCheck size={14} aria-hidden="true" />
                ) : (
                  <CircleX size={14} aria-hidden="true" />
                )}
                {describeFinishedRun(run)}
              </code>
            )}
          </pre>
        </section>
      )}
      {runnerSource && (
        <iframe
          key={runnerKey}
          ref={runnerFrameRef}
          className="runner-frame"
          sandbox="allow-scripts"
          srcDoc={runnerSource}
          title="JavaScript code runner"
        />
      )}
    </div>
  );
}

const OUTPUT_HEIGHT_KEY = 'collabcode-output-height';
const DEFAULT_OUTPUT_HEIGHT = 260;
const MIN_OUTPUT_HEIGHT = 120;
const RUNNABLE = new Set(['javascript', 'typescript', 'python', 'java', 'cpp']);

const formatDuration = (ms) => (ms < 1000 ? `${Math.max(1, Math.round(ms))} ms` : `${(ms / 1000).toFixed(2)} s`);

function describeFinishedRun(run) {
  const time = formatDuration(run.duration);
  if (run.status === 'success') return `Finished in ${time}`;
  return run.exitCode !== undefined ? `Exited with code ${run.exitCode} after ${time}` : `Failed after ${time}`;
}

// The badge in the console header: running, finished or failed.
function RunStatus({ run }) {
  if (!run) return null;
  if (run.status === 'running') {
    return (
      <Badge tone="soft" className="run-status">
        <Spinner />
        Running
      </Badge>
    );
  }
  return (
    <Badge tone={run.status === 'success' ? 'success' : 'danger'} dot className="run-status">
      {run.status === 'success' ? 'Done' : 'Error'} · {formatDuration(run.duration)}
    </Badge>
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
  // The stack is mostly the sandbox's own frames; keep the message and where it happened in
  // the user's code (eval reports it as <anonymous>:line:column).
  const describeError = (error) => {
    if (!(error instanceof Error)) return error;
    const where = /<anonymous>:(\\d+):(\\d+)/.exec(error.stack || '');
    const text = error.name + ': ' + error.message;
    return where ? text + ' (line ' + where[1] + ', column ' + where[2] + ')' : text;
  };
  for (const method of ['log', 'info', 'warn', 'error']) {
    console[method] = (...values) => send(method === 'error' ? 'error' : 'log', values);
  }
  self.onmessage = async ({ data }) => {
    try {
      const result = (0, eval)(data.code);
      const value = await Promise.resolve(result);
      if (value !== undefined) send('log', [value]);
    } catch (error) {
      send('error', [describeError(error)]);
    } finally {
      send('done');
    }
  };
  postMessage({ type: 'ready' });
`;

function createRunnerDocument(code) {
  const safelyEncodedCode = JSON.stringify(code).replace(/</g, '\\u003c');
  const safelyEncodedWorker = JSON.stringify(RUNNER_WORKER_SOURCE).replace(/</g, '\\u003c');
  // The sandboxed frame inherits the page's Content-Security-Policy, so its inline script
  // needs the page's nonce (set per request by nginx in production; absent in development).
  const nonce = document.querySelector('script[nonce]')?.nonce;
  const nonceAttribute = nonce && /^[A-Za-z0-9+/=_-]+$/.test(nonce) ? ` nonce="${nonce}"` : '';
  return `<!doctype html><html><body><script${nonceAttribute}>
    const source = 'collabcode-runner';
    const workerUrl = URL.createObjectURL(new Blob([${safelyEncodedWorker}], { type: 'text/javascript' }));
    const worker = new Worker(workerUrl);
    let completed = false;
    let runTimeout = null;
    const closeWorker = () => {
      if (completed) return;
      completed = true;
      clearTimeout(startTimeout);
      clearTimeout(runTimeout);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    };
    const relay = (payload) => parent.postMessage({ source, ...payload }, '*');
    const stop = (text) => {
      relay({ type: 'error', text });
      relay({ type: 'done' });
      closeWorker();
    };
    // The 3-second limit covers the user's code only. Starting a worker can take longer on a
    // slow or busy device, so it gets its own, more generous limit.
    const startTimeout = setTimeout(() => stop('The JavaScript runner did not start. Try running again.'), 15000);
    worker.onmessage = ({ data }) => {
      if (data.type === 'ready') {
        clearTimeout(startTimeout);
        runTimeout = setTimeout(() => stop('Execution stopped after 3 seconds.'), 3000);
        worker.postMessage({ code: ${safelyEncodedCode} });
        return;
      }
      relay(data);
      if (data.type === 'done') closeWorker();
    };
    worker.onerror = (event) => stop(event.message || 'The JavaScript runner failed.');
  </script></body></html>`;
}
