import { Users } from 'lucide-react';
import { Avatar } from './ui/Avatar.jsx';
import { CopyButton } from './ui/CopyButton.jsx';
import { Badge, EmptyState } from './ui/Feedback.jsx';

// Everyone in the room, you first. A presence dot shows each person is here and pulses while
// they type; the stripe on the right is their cursor color in the editor.
export function ParticipantsPanel({ participants, selfSocketId, typingSocketIds, inviteUrl, onInviteBlocked }) {
  const sorted = [...participants].sort((a, b) =>
    a.socketId === selfSocketId ? -1 : b.socketId === selfSocketId ? 1 : 0,
  );
  return (
    <div className="panel">
      <ul
        className="people-list stagger"
        aria-label={`${participants.length} ${participants.length === 1 ? 'person' : 'people'} in this room`}
      >
        {sorted.map((person, index) => {
          const isSelf = person.socketId === selfSocketId;
          const isTyping = typingSocketIds.has(person.socketId);
          return (
            <li key={person.socketId} className="person" style={{ '--i': index }}>
              <Avatar name={person.name} color={person.color} status={isTyping ? 'typing' : 'online'} />
              <span className="person-text">
                <span className="person-name">
                  {person.name}
                  {isSelf && <span className="sr-only"> (you)</span>}
                </span>
                {/* Not a live region: the status bar already announces who is typing. */}
                <span className="person-activity">
                  {isTyping ? (
                    <span className="typing-indicator">
                      <span className="typing-dots" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                      typing
                    </span>
                  ) : (
                    'Online'
                  )}
                </span>
              </span>
              {isSelf && (
                <Badge tone="soft" aria-hidden="true">
                  You
                </Badge>
              )}
              <span
                className={`presence-cursor presence-${person.color}`}
                data-tooltip={`${person.name}'s cursor color`}
                aria-hidden="true"
              />
            </li>
          );
        })}
      </ul>
      {participants.length === 1 && (
        <EmptyState icon={Users} title="It's just you for now">
          Share the invite link and anyone can join in a click.
        </EmptyState>
      )}
      <div className="panel-footer">
        <CopyButton text={inviteUrl} label="Copy invite link" block onCopyFailed={onInviteBlocked} />
      </div>
    </div>
  );
}
