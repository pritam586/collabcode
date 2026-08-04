const languages = [
  ['javascript', 'JavaScript'],
  ['typescript', 'TypeScript'],
  ['python', 'Python'],
  ['json', 'JSON'],
  ['css', 'CSS'],
  ['html', 'HTML'],
  ['markdown', 'Markdown'],
];

export function LanguageSelector({ language, onChange }) {
  return (
    <label className="language-picker">
      <span className="sr-only">Editor language</span>
      <select value={language} onChange={(event) => onChange(event.target.value)}>
        {languages.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select>
    </label>
  );
}
