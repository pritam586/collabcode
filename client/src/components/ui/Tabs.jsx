import { useId, useLayoutEffect, useRef } from 'react';

// Accessible tabs (WAI-ARIA tabs pattern): arrow keys, Home and End move between tabs, and
// only the selected tab is in the Tab order. `tabs` is [{ id, label, icon?, badge?, content }].
// Panels stay mounted so chat scroll position and drafts survive switching tabs.
export function Tabs({ tabs, selectedId, onSelect, label }) {
  const baseId = useId();
  const tabRefs = useRef({});
  const listRef = useRef(null);

  // Slide the indicator under the selected tab, and keep it there when the list resizes.
  // It only animates after the first placement, so it does not sweep in on page load.
  useLayoutEffect(() => {
    const list = listRef.current;
    const selected = tabRefs.current[selectedId];
    if (!list || !selected) return undefined;
    const place = () => {
      list.style.setProperty('--indicator-x', `${selected.offsetLeft}px`);
      list.style.setProperty('--indicator-width', `${selected.offsetWidth}px`);
    };
    place();
    const frame = requestAnimationFrame(() => list.setAttribute('data-indicator-ready', ''));
    if (typeof ResizeObserver === 'undefined') return () => cancelAnimationFrame(frame);
    const observer = new ResizeObserver(place);
    observer.observe(list);
    observer.observe(selected);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [selectedId]);

  function handleKeyDown(event) {
    const index = tabs.findIndex((tab) => tab.id === selectedId);
    const moves = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = tabs[(moves[event.key] + tabs.length) % tabs.length];
    onSelect(next.id);
    tabRefs.current[next.id]?.focus();
  }

  return (
    <div className="tabs">
      <div className="tab-list" role="tablist" aria-label={label} ref={listRef}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            ref={(element) => {
              tabRefs.current[tab.id] = element;
            }}
            type="button"
            role="tab"
            className="tab"
            id={`${baseId}-tab-${tab.id}`}
            aria-selected={tab.id === selectedId}
            aria-controls={`${baseId}-panel-${tab.id}`}
            tabIndex={tab.id === selectedId ? 0 : -1}
            onClick={() => onSelect(tab.id)}
            onKeyDown={handleKeyDown}
          >
            {tab.icon}
            {tab.label}
            {tab.badge}
          </button>
        ))}
        <span className="tab-indicator" aria-hidden="true" />
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          className="tab-panel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== selectedId}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
