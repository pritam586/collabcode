import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MessageSquare, RotateCw, SendHorizontal, X } from 'lucide-react';
import { Avatar } from './ui/Avatar.jsx';
import { IconButton } from './ui/Button.jsx';
import { EmptyState } from './ui/Feedback.jsx';

const MAX_LENGTH = 1000;
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function ChatPanel({ messages, pendingMessages, selfSocketId, onSend, onDiscard, isVisible }) {
  const [draft, setDraft] = useState('');
  const listRef = useRef(null);
  const stickToBottomRef = useRef(true);

  // Follow new messages unless the reader has scrolled up to read older ones.
  function handleScroll() {
    const list = listRef.current;
    stickToBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  }

  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && stickToBottomRef.current) list.scrollTop = list.scrollHeight;
  }, [messages.length, pendingMessages.length, isVisible]);

  useEffect(() => {
    if (isVisible) stickToBottomRef.current = true;
  }, [isVisible]);

  function send() {
    const body = draft.trim();
    if (!body || body.length > MAX_LENGTH) return;
    onSend(body);
    setDraft('');
    stickToBottomRef.current = true;
  }

  function handleKeyDown(event) {
    // Enter sends; Shift+Enter adds a line. Ignore Enter while an IME is composing.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  }

  const remaining = MAX_LENGTH - draft.length;
  const isEmpty = messages.length === 0 && pendingMessages.length === 0;

  return (
    <div className="panel chat-panel">
      <div
        className="chat-log"
        ref={listRef}
        onScroll={handleScroll}
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        tabIndex={0}
      >
        {isEmpty && (
          <EmptyState icon={MessageSquare} title="No messages yet">
            Say hello, or ask about a line of code. Messages stay with the room for anyone who joins later.
          </EmptyState>
        )}
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const grouped =
            previous &&
            previous.author?.name === message.author?.name &&
            message.createdAt - previous.createdAt < GROUP_WINDOW_MS;
          const isSelf = message.author?.socketId === selfSocketId;
          return (
            <article
              key={message.id}
              className={['chat-message', grouped && 'is-grouped', isSelf && 'is-self'].filter(Boolean).join(' ')}
            >
              {!grouped && (
                <header className="chat-meta">
                  <Avatar name={message.author?.name} color={message.author?.color} size="sm" />
                  <span className="chat-author">
                    {message.author?.name}
                    {isSelf && ' (you)'}
                  </span>
                  <time
                    dateTime={new Date(message.createdAt).toISOString()}
                    data-tooltip={dateTimeFormat.format(message.createdAt)}
                  >
                    {timeFormat.format(message.createdAt)}
                  </time>
                </header>
              )}
              <p className="chat-body">{message.body}</p>
            </article>
          );
        })}
        {pendingMessages.map((message) => (
          <article
            key={message.clientId}
            className={`chat-message is-self is-grouped is-pending ${message.status === 'failed' ? 'is-failed' : ''}`}
          >
            <p className="chat-body">{message.body}</p>
            <p className="chat-status">
              {message.status === 'failed' ? (
                <>
                  <span>Not sent.</span>
                  <IconButton
                    label="Try sending again"
                    size="sm"
                    onClick={() => onSend(message.body, message.clientId)}
                  >
                    <RotateCw size={14} aria-hidden="true" />
                  </IconButton>
                  <IconButton label="Discard message" size="sm" onClick={() => onDiscard(message.clientId)}>
                    <X size={14} aria-hidden="true" />
                  </IconButton>
                </>
              ) : (
                <span>Sending…</span>
              )}
            </p>
          </article>
        ))}
      </div>

      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <label className="sr-only" htmlFor="chat-input">
          Message the room
        </label>
        <textarea
          id="chat-input"
          className="input"
          rows={2}
          maxLength={MAX_LENGTH}
          placeholder="Message the room…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-describedby="chat-hint"
        />
        <IconButton
          type="submit"
          label="Send message"
          shortcut="Enter"
          className={draft.trim() ? 'chat-send is-ready' : 'chat-send'}
          disabled={!draft.trim()}
        >
          <SendHorizontal size={18} aria-hidden="true" />
        </IconButton>
        <p className="chat-hint" id="chat-hint">
          {remaining < 100 ? `${remaining} characters left` : 'Enter to send, Shift+Enter for a new line'}
        </p>
      </form>
    </div>
  );
}
