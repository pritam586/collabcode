export const LANGUAGES = [
  ['javascript', 'JavaScript', 'js'],
  ['typescript', 'TypeScript', 'ts'],
  ['java', 'Java', 'java'],
  ['cpp', 'C++', 'cpp'],
  ['python', 'Python', 'py'],
  ['json', 'JSON', 'json'],
  ['css', 'CSS', 'css'],
  ['html', 'HTML', 'html'],
  ['markdown', 'Markdown', 'md'],
];

export function getFileExtension(language) {
  return LANGUAGES.find(([value]) => value === language)?.[2] || 'txt';
}

// The file name shown on the editor tab and in the console's command line.
export function getFileName(language) {
  return language === 'java' ? 'Main.java' : `main.${getFileExtension(language)}`;
}

// What the console shows as the command for a run, like a terminal would.
const RUN_COMMANDS = {
  javascript: 'node main.js',
  typescript: 'tsx main.ts',
  python: 'python main.py',
  java: 'java Main.java',
  cpp: 'g++ main.cpp -o main && ./main',
};

export function getRunCommand(language) {
  return RUN_COMMANDS[language] ?? `run ${getFileName(language)}`;
}
