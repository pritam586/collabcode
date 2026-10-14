import { Monitor, Moon, Sun } from 'lucide-react';
import { IconButton } from './ui/Button.jsx';

const ORDER = ['system', 'light', 'dark'];
const DETAILS = {
  system: { icon: Monitor, label: 'Theme: match system' },
  light: { icon: Sun, label: 'Theme: light' },
  dark: { icon: Moon, label: 'Theme: dark' },
};

// One button that cycles system -> light -> dark. Its label always states the current theme.
export function ThemeToggle({ preference, setPreference }) {
  const { icon: Icon, label } = DETAILS[preference] ?? DETAILS.system;
  const next = ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length];
  return (
    <IconButton label={`${label}. Switch to ${DETAILS[next].label.replace('Theme: ', '')}`} title={label} onClick={() => setPreference(next)}>
      <Icon size={18} aria-hidden="true" />
    </IconButton>
  );
}
