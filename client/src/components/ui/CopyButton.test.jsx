import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { CopyButton } from './CopyButton.jsx';

test('copies, confirms with "Copied!" and an announcement, then resets', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<CopyButton text="https://example.com/r/swift-otter-4821" label="Copy invite link" />);

  await user.click(screen.getByRole('button', { name: 'Copy invite link' }));
  expect(await navigator.clipboard.readText()).toBe('https://example.com/r/swift-otter-4821');
  expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Copied to the clipboard');

  act(() => vi.advanceTimersByTime(2100));
  expect(screen.getByRole('button', { name: 'Copy invite link' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('');
  vi.useRealTimers();
});

test('reports a blocked clipboard instead of claiming success', async () => {
  const user = userEvent.setup();
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('blocked'));
  document.execCommand = vi.fn(() => false);
  const onCopyFailed = vi.fn();
  render(<CopyButton text="link" onCopyFailed={onCopyFailed} />);

  await user.click(screen.getByRole('button', { name: 'Copy link' }));
  expect(onCopyFailed).toHaveBeenCalledOnce();
  expect(screen.queryByRole('button', { name: 'Copied!' })).not.toBeInTheDocument();
});
