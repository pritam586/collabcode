import { CloudOff, CircleCheck } from 'lucide-react';
import { LANGUAGES } from '../constants/languages.js';

function describeTyping(names) {
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names.length} people are typing…`;
}

export function StatusBar({ status, typingNames, language, fontSize }) {
  const live = status === 'joined';
  const languageLabel = LANGUAGES.find(([value]) => value === language)?.[1] ?? language;
  return (
    <footer className="status-bar">
      <span className={`status-sync ${live ? 'is-live' : 'is-offline'}`} role="status">
        {live ? <CircleCheck size={14} aria-hidden="true" /> : <CloudOff size={14} aria-hidden="true" />}
        {live ? 'All changes synced' : 'Offline. Changes are kept and will sync.'}
      </span>
      <span className="status-typing" aria-live="polite">{describeTyping(typingNames)}</span>
      <span className="status-meta hide-tablet">{languageLabel}</span>
      <span className="status-meta hide-tablet">{fontSize}px</span>
    </footer>
  );
}
