import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

// jsdom implements <dialog> but not its modal methods.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function close() {
    this.open = false;
  };
});

// jsdom has no matchMedia. Tests get a desktop, mouse-driven, dark-mode browser.
window.matchMedia ??= vi.fn((query) => ({
  matches: query.includes('prefers-color-scheme: dark'),
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
}));
