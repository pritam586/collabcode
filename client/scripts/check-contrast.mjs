// Checks WCAG 2.2 AA contrast for the color tokens in src/styles/tokens.css, in both themes.
// Text needs 4.5:1; borders, icons and focus rings need 3:1 (success criterion 1.4.11).
// Exits with code 1 if any pair fails. Run with: npm run check:contrast
import { readFileSync } from 'node:fs';

// Quote style in selectors does not matter: compare with double quotes made single.
const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8').replaceAll('"', "'");

// Reads the hex color tokens in one top-level block. A missing block is an error, not a pass.
function readBlock(selector) {
  const start = css.indexOf(`\n${selector} {`);
  if (start === -1) throw new Error(`tokens.css has no "${selector}" block.`);
  const end = css.indexOf('\n}', start);
  const tokens = {};
  for (const [, name, value] of css.slice(start, end).matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi))
    tokens[name] = value;
  return tokens;
}

const dark = readBlock(':root');
const themes = { dark, light: { ...dark, ...readBlock(":root[data-theme='light']") } };

const TEXT = 4.5;
const UI = 3;
const pairs = [
  ...['bg', 'surface', 'surface-raised', 'surface-sunken', 'surface-hover'].flatMap((background) => [
    ['color-text', background, TEXT],
    ['color-text-muted', background, TEXT],
  ]),
  ...['bg', 'surface', 'surface-raised', 'surface-sunken'].map((background) => ['color-text-subtle', background, TEXT]),
  // Primary buttons: white text over every stop of the strong gradient.
  ['color-on-brand', 'brand-violet-strong', TEXT],
  ['color-on-brand', 'brand-blue-strong', TEXT],
  ['color-on-brand', 'brand-cyan-strong', TEXT],
  // Code on the editor surface (the landing mockup and Monaco).
  ...['text', 'comment', 'keyword', 'function', 'string', 'number', 'property', 'punctuation'].map((role) => [
    `syntax-${role}`,
    'editor-bg',
    TEXT,
  ]),
  ['editor-gutter', 'editor-bg', UI],
  // Tooltips invert the page colors.
  ['color-bg', 'color-text', TEXT],
  ['color-info', 'color-surface', TEXT],
  ['color-accent-text', 'color-bg', TEXT],
  ['color-accent-text', 'color-surface', TEXT],
  ['color-accent-text', 'color-surface-raised', TEXT],
  ['color-on-accent', 'color-accent', TEXT],
  ['color-on-accent', 'color-accent-hover', TEXT],
  ['color-danger', 'color-surface', TEXT],
  ['color-danger', 'color-surface-raised', TEXT],
  ['color-danger', 'color-surface-sunken', TEXT],
  ['color-warning', 'color-surface', TEXT],
  ['color-success', 'color-surface', UI],
  ['color-focus', 'color-bg', UI],
  ['color-focus', 'color-surface', UI],
  ['color-border-strong', 'color-surface', UI],
  ['color-border-strong', 'color-surface-sunken', UI],
  ['color-accent', 'color-surface', UI],
  ...['violet', 'cyan', 'amber', 'rose', 'lime', 'sky'].map((color) => [
    'color-on-presence',
    `presence-${color}`,
    TEXT,
  ]),
].map(([foreground, background, minimum]) => [
  foreground,
  /^(color|presence|brand|editor)-/.test(background) ? background : `color-${background}`,
  minimum,
]);

function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [light, darkest] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (darkest + 0.05);
}

let failures = 0;
for (const [theme, tokens] of Object.entries(themes)) {
  for (const [foreground, background, minimum] of pairs) {
    const value = ratio(tokens[foreground], tokens[background]);
    const ok = value >= minimum;
    if (!ok) failures += 1;
    if (!ok || process.argv.includes('--verbose')) {
      console.log(
        `${ok ? 'ok  ' : 'FAIL'} ${theme.padEnd(5)} ${foreground} on ${background}: ${value.toFixed(2)} (needs ${minimum})`,
      );
    }
  }
}

console.log(
  failures === 0 ? `All ${pairs.length * 2} color pairs meet WCAG AA.` : `${failures} color pair(s) fail WCAG AA.`,
);
process.exit(failures === 0 ? 0 : 1);
