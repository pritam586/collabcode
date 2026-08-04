export const LANGUAGES = [
  ['javascript', 'JavaScript', 'js'],
  ['typescript', 'TypeScript', 'ts'],
  ['python', 'Python', 'py'],
  ['json', 'JSON', 'json'],
  ['css', 'CSS', 'css'],
  ['html', 'HTML', 'html'],
  ['markdown', 'Markdown', 'md'],
];

export function getFileExtension(language) {
  return LANGUAGES.find(([value]) => value === language)?.[2] || 'txt';
}
