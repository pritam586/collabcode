import { useRef } from 'react';

// Bottom tab bar for phones: one view at a time (code, output, chat, tasks, people).
// Follows the WAI-ARIA tabs pattern, so arrow keys work with a hardware keyboard too.
export function MobileNav({ items, selectedId, onSelect }) {
  const buttonRefs = useRef({});

  function handleKeyDown(event) {
    const index = items.findIndex((item) => item.id === selectedId);
    const moves = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: items.length - 1 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = items[(moves[event.key] + items.length) % items.length];
    onSelect(next.id);
    buttonRefs.current[next.id]?.focus();
  }

  return (
    <nav className="mobile-nav" aria-label="Room views" data-tour="sidebar">
      <div role="tablist" aria-label="Room views" className="mobile-nav-list">
        {items.map(({ id, label, icon: Icon, controls, badge }) => (
          <button
            key={id}
            ref={(element) => {
              buttonRefs.current[id] = element;
            }}
            type="button"
            role="tab"
            className="mobile-nav-item"
            aria-selected={id === selectedId}
            aria-controls={controls}
            tabIndex={id === selectedId ? 0 : -1}
            onClick={() => onSelect(id)}
            onKeyDown={handleKeyDown}
          >
            <span className="mobile-nav-icon">
              <Icon size={20} aria-hidden="true" />
              {badge?.count > 0 && (
                <span className={`badge ${badge.accent ? 'badge-accent' : ''} mobile-nav-badge`} aria-hidden="true">
                  {badge.count}
                </span>
              )}
            </span>
            <span className="mobile-nav-label">{label}</span>
            {badge?.count > 0 && <span className="sr-only">, {badge.label}</span>}
          </button>
        ))}
      </div>
    </nav>
  );
}
