import { useCallback, useEffect, useState } from 'react';
import { readStorage, writeStorage } from '../lib/storage.js';

const THEME_KEY = 'collabcode-theme';
const FONT_SIZE_KEY = 'collabcode-font-size';
const NAME_KEY = 'collabcode-name';
export const FONT_SIZES = { min: 12, max: 22, default: 14 };
const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;

// preference: 'system' | 'light' | 'dark'. The resolved theme is written to
// <html data-theme>; index.html applies it before React loads so there is no flash.
export function useTheme() {
  const [preference, setPreferenceState] = useState(() => readStorage(THEME_KEY, 'system'));
  const [systemIsDark, setSystemIsDark] = useState(systemDark);
  const theme = preference === 'system' ? (systemIsDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return undefined;
    const handleChange = (event) => setSystemIsDark(event.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0d1018' : '#f5f6fa');
  }, [theme]);

  const setPreference = useCallback((next) => {
    setPreferenceState(next);
    writeStorage(THEME_KEY, next);
  }, []);

  return { preference, theme, setPreference };
}

export function useFontSize() {
  const [fontSize, setFontSizeState] = useState(() => clampFontSize(readStorage(FONT_SIZE_KEY, FONT_SIZES.default)));
  const setFontSize = useCallback((next) => {
    const value = clampFontSize(next);
    setFontSizeState(value);
    writeStorage(FONT_SIZE_KEY, value);
  }, []);
  return [fontSize, setFontSize];
}

function clampFontSize(value) {
  return Number.isFinite(value) ? Math.min(FONT_SIZES.max, Math.max(FONT_SIZES.min, Math.round(value))) : FONT_SIZES.default;
}

export function readSavedName() {
  return readStorage(NAME_KEY, '');
}

export function saveName(name) {
  writeStorage(NAME_KEY, name);
}
