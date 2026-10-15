import { UserPlus } from 'lucide-react';
import { Avatar } from './ui/Avatar.jsx';
import { Button } from './ui/Button.jsx';

export function ParticipantsPanel({ participants, selfSocketId, typingSocketIds, onInvite }) {
  const sorted = [...participants].sort((a, b) =>
    a.socketId === selfSocketId ? -1 : b.socketId === selfSocketId ? 1 : 0,
  );
  return (
    <div className="panel">
      <ul
        className="people-list"
        aria-label={`${participants.length} ${participants.length === 1 ? 'person' : 'people'} in this room`}
      >
        {sorted.map((person) => {
          const isSelf = person.socketId === selfSocketId;
          const isTyping = typingSocketIds.has(person.socketId);
          return (
            <li key={person.socketId} className="person">
              <Avatar name={person.name} color={person.color} />
              <span className="person-name">
                {person.name}
                {isSelf && <span className="person-tag"> (you)</span>}
              </span>
              {isTyping ? (
                <span className="typing-indicator" title={`${person.name} is typing`}>
                  <span className="typing-dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="sr-only">typing</span>
                </span>
              ) : (
                <span
                  className={`presence-cursor presence-${person.color}`}
                  title={`${person.name}'s cursor color`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ul>
      {participants.length === 1 && (
        <div className="empty-state">
          <strong>It is just you for now</strong>
          <p>Share the invite link and others can join in a click.</p>
        </div>
      )}
      <div className="panel-footer">
        <Button variant="secondary" block icon={<UserPlus size={16} aria-hidden="true" />} onClick={onInvite}>
          Copy invite link
        </Button>
      </div>
    </div>
  );
}
