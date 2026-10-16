import { useEffect, useRef, useState } from 'react';
import { CircleCheck, Play } from 'lucide-react';
import { Avatar } from '../ui/Avatar.jsx';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';

// Each line is a list of [token, text] pairs; the token picks the syntax color.
const LINES = [
  [
    ['kw', 'import'],
    ['', ' '],
    ['punc', '{ '],
    ['var', 'createRoom'],
    ['punc', ' }'],
    ['', ' '],
    ['kw', 'from'],
    ['', ' '],
    ['str', "'./collab.js'"],
    ['punc', ';'],
  ],
  [],
  [['com', '// Everyone here edits this file live.']],
  [
    ['kw', 'export'],
    ['', ' '],
    ['kw', 'async'],
    ['', ' '],
    ['kw', 'function'],
    ['', ' '],
    ['fn', 'shipIt'],
    ['punc', '('],
    ['var', 'team'],
    ['punc', ') {'],
  ],
  [
    ['', '  '],
    ['kw', 'const'],
    ['', ' '],
    ['var', 'room'],
    ['punc', ' = '],
    ['kw', 'await'],
    ['', ' '],
    ['fn', 'createRoom'],
    ['punc', '('],
    ['ada', "'launch-day'"],
    ['punc', ');'],
  ],
  [
    ['', '  '],
    ['var', 'team'],
    ['punc', '.'],
    ['fn', 'forEach'],
    ['punc', '(('],
    ['var', 'p'],
    ['punc', ') => '],
    ['var', 'room'],
    ['punc', '.'],
    ['fn', 'invite'],
    ['punc', '('],
    ['var', 'p'],
    ['punc', '));'],
  ],
  'typed',
  [['punc', '}']],
];

// The line Grace types, one character at a time.
const TYPED = [
  ['kw', 'return'],
  ['', ' '],
  ['var', 'room'],
  ['punc', '.'],
  ['fn', 'run'],
  ['punc', '('],
  ['str', "'npm test'"],
  ['punc', ');'],
];
const TYPED_LENGTH = TYPED.reduce((total, [, text]) => total + text.length, 0);

function Tokens({ tokens }) {
  return tokens.map(([token, text], index) =>
    token === 'ada' ? (
      // Ada has this string selected; her cursor sits at its end.
      <span key={index} className="mock-selection">
        <span className="tok-str">{text}</span>
        <Caret name="Ada" color="violet" />
      </span>
    ) : (
      <span key={index} className={token ? `tok-${token}` : undefined}>
        {text}
      </span>
    ),
  );
}

function Caret({ name, color, typing = false }) {
  return (
    <span className={`mock-caret mock-caret-${color}${typing ? ' is-typing' : ''}`}>
      <span className="mock-flag">{name}</span>
    </span>
  );
}

// Grace's line, cut off after `count` characters.
function typedTokens(count) {
  let remaining = count;
  const tokens = [];
  for (const [token, text] of TYPED) {
    if (remaining <= 0) break;
    tokens.push([token, text.slice(0, remaining)]);
    remaining -= text.length;
  }
  return tokens;
}

// Types Grace's line, "runs" it, holds, erases and starts again. It only runs while the
// mockup is on screen; with reduced motion it shows the finished state and stays still.
function useTypingLoop(running) {
  const [typed, setTyped] = useState(0);
  const [ran, setRan] = useState(false);

  useEffect(() => {
    if (!running) return undefined;
    let count = 0;
    let timer;
    const later = (callback, ms) => {
      timer = setTimeout(callback, ms);
    };
    function type() {
      count += 1;
      setTyped(count);
      if (count < TYPED_LENGTH) later(type, 45 + Math.random() * 75);
      else later(run, 650);
    }
    function run() {
      setRan(true);
      later(erase, 3600);
    }
    function erase() {
      setRan(false);
      count = Math.max(0, count - 3);
      setTyped(count);
      if (count > 0) later(erase, 22);
      else later(type, 900);
    }
    later(() => {
      setTyped(0);
      setRan(false);
      type();
    }, 700);
    return () => clearTimeout(timer);
  }, [running]);

  return { typed, ran };
}

export function EditorMockup() {
  const rootRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const loop = useTypingLoop(visible && !reduceMotion);
  const typed = reduceMotion ? TYPED_LENGTH : loop.typed;
  const ran = reduceMotion || loop.ran;
  const typing = typed > 0 && typed < TYPED_LENGTH;

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.2 });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      className="mockup"
      role="img"
      aria-label="Preview of a CollabCode room: Ada and Grace edit the same file with live cursors, run it, and chat beside the code."
    >
      <div className="mockup-bar">
        <span className="mockup-dots" />
        <span className="mockup-file">main.js</span>
        <span className="mockup-bar-end">
          <span className="mockup-avatars">
            <Avatar name="Ada" color="violet" size="sm" />
            <Avatar name="Grace" color="cyan" size="sm" />
            <Avatar name="You" color="amber" size="sm" />
          </span>
          <span className="mockup-run">
            <Play size={12} />
            Run
          </span>
        </span>
      </div>

      <div className="mockup-body">
        <div className="mockup-main">
          <pre className="mockup-code">
            {LINES.map((line, index) => (
              <span
                key={index}
                className={line === 'typed' ? 'mockup-line is-active' : 'mockup-line'}
                data-line={index + 1}
              >
                {line === 'typed' ? (
                  <>
                    <span>{'  '}</span>
                    <Tokens tokens={typedTokens(typed)} />
                    <Caret name="Grace" color="cyan" typing={typing} />
                  </>
                ) : (
                  <Tokens tokens={line} />
                )}
              </span>
            ))}
          </pre>
          <div className="mockup-output">
            <span className="mockup-prompt">$ node main.js</span>
            <span className={ran ? 'mockup-result is-shown' : 'mockup-result'}>
              <CircleCheck size={14} />3 tests passed in 0.42s
            </span>
          </div>
        </div>

        <div className="mockup-side">
          <span className="mockup-side-title">People</span>
          <span className="mockup-person">
            <Avatar name="Ada" color="violet" size="sm" status="online" />
            Ada
          </span>
          <span className="mockup-person">
            <Avatar name="Grace" color="cyan" size="sm" status={typing ? 'typing' : 'online'} />
            Grace
            {typing && <em className="mockup-typing">typing…</em>}
          </span>
          <span className="mockup-side-title">Chat</span>
          <span className="mockup-bubble">
            <b>Ada</b> Can you add the test run?
          </span>
          <span className={ran ? 'mockup-bubble is-shown' : 'mockup-bubble is-pending'}>
            <b>Grace</b> Done. All green.
          </span>
        </div>
      </div>
    </div>
  );
}
