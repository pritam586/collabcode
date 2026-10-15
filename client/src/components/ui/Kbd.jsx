import { MOD_KEY } from '../../lib/platform.js';

// Renders a shortcut like "Mod+Enter" as separate keys (Mod is Ctrl, or ⌘ on a Mac).
export function Shortcut({ keys }) {
  const parts = keys.split('+').map((key) => (key === 'Mod' ? MOD_KEY : key));
  return (
    <span className="shortcut" aria-label={parts.join(' plus ')}>
      {parts.map((key, index) => (
        <kbd className="kbd" key={`${key}-${index}`} aria-hidden="true">
          {key}
        </kbd>
      ))}
    </span>
  );
}
