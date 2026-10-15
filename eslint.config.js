// One ESLint config for the whole repository (flat config).
// ESLint 9 is used, not 10: eslint-plugin-react and eslint-plugin-jsx-a11y do not support 10 yet.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default [
  {
    ignores: ['**/node_modules/', '**/dist/', '**/coverage/', 'playwright-report/', 'test-results/', 'server/data/'],
  },
  js.configs.recommended,
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      'prefer-const': 'error',
    },
  },

  // Server: Node.js ES modules.
  {
    files: ['server/**/*.js'],
    languageOptions: { globals: globals.node },
  },

  // Client: React in the browser.
  {
    files: ['client/**/*.{js,jsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks, 'react-refresh': reactRefresh, 'jsx-a11y': jsxA11y },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      // Scrollable regions (the chat log) must be focusable so keyboard users can scroll them.
      'jsx-a11y/no-noninteractive-tabindex': [
        'error',
        { tags: [], roles: ['tabpanel', 'log'], allowExpressionValues: true },
      ],
      // Props are documented by usage and comments; the project does not use PropTypes.
      'react/prop-types': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['client/scripts/**/*.mjs', 'client/*.config.js', 'playwright.config.js'],
    languageOptions: { globals: globals.node },
    // Command-line scripts report to the terminal.
    rules: { 'no-console': 'off' },
  },
  {
    // Playwright specs run in Node, but page.evaluate() callbacks run in the browser.
    files: ['e2e/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['client/**/*.test.{js,jsx}', 'client/src/test/**/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },

  // Formatting is Prettier's job; turn off every rule that would fight it.
  prettier,
];
