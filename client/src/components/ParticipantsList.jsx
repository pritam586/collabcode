function initials(name) {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

export function ParticipantsList({ participants, selfSocketId }) {
  return (
    <aside className="participants-panel" aria-label="Participants">
      <div className="panel-heading"><span>IN THE ROOM</span><span>{participants.length}</span></div>
      <ul className="participants-list">
        {participants.map((person) => (
          <li key={person.socketId}>
            <span className={`avatar avatar-${person.color}`}>{initials(person.name)}</span>
            <span className="participant-name">{person.name}{person.socketId === selfSocketId ? ' (you)' : ''}</span>
            <span className="presence-dot" title="Online" />
          </li>
        ))}
      </ul>
    </aside>
  );
}
