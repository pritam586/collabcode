import { LANGUAGES } from '../constants/languages.js';

export function LanguageSelector({ language, onChange }) {
  return (
    <label className="language-picker">
      <span className="sr-only">Editor language</span>
      <select value={language} onChange={(event) => onChange(event.target.value)}>
        {LANGUAGES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select>
    </label>
  );
}
