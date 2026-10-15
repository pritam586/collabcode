import { afterEach, expect, test, vi } from 'vitest';
import { createId, readStorage, writeStorage } from './storage.js';

afterEach(() => vi.restoreAllMocks());

test('round-trips JSON values', () => {
  writeStorage('example', { theme: 'dark', size: 16 });
  expect(readStorage('example', null)).toEqual({ theme: 'dark', size: 16 });
});

test('returns the fallback for missing keys', () => {
  expect(readStorage('missing', 'fallback')).toBe('fallback');
});

test('reads plain strings saved by older versions', () => {
  window.localStorage.setItem('collabcode-name', 'Grace');
  expect(readStorage('collabcode-name', '')).toBe('Grace');
});

test('keeps working when storage is blocked', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('SecurityError');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('QuotaExceededError');
  });
  expect(() => writeStorage('key', 1)).not.toThrow();
  expect(readStorage('key', 'fallback')).toBe('fallback');
});

test('createId returns distinct ids', () => {
  expect(createId()).not.toBe(createId());
});
