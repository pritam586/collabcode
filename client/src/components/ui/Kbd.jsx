// Mac keyboards say ⌘ where others say Ctrl.
export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const MOD_KEY = isMac ? '⌘' : 'Ctrl';

// Renders a shortcut like "Mod+Enter" as separate keys.
export function Shortcut({ keys }) {
  const parts = keys.split('+').map((key) => (key === 'Mod' ? MOD_KEY : key));
  return (
    <span className="shortcut" aria-label={parts.join(' plus ')}>
      {parts.map((key, index) => <kbd className="kbd" key={`${key}-${index}`} aria-hidden="true">{key}</kbd>)}
    </span>
  );
}
