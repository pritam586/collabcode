import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { ToastProvider } from './Toast.jsx';
import { useToast } from './useToast.js';

function Trigger({ type, message, id }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast[type](message, id ? { id } : undefined)}>
      show {type}
    </button>
  );
}

test('errors are announced assertively and other toasts politely', async () => {
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <Trigger type="error" message="Server unreachable" />
      <Trigger type="success" message="Link copied" />
    </ToastProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'show error' }));
  await user.click(screen.getByRole('button', { name: 'show success' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Server unreachable');
  expect(screen.getByRole('status')).toHaveTextContent('Link copied');
});

test('toasts dismiss themselves, or with their close button', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(
    <ToastProvider>
      <Trigger type="success" message="Link copied" />
      <Trigger type="info" message="Heads up" />
    </ToastProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'show success' }));
  act(() => vi.advanceTimersByTime(4000));
  expect(screen.queryByText('Link copied')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'show info' }));
  await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));
  expect(screen.queryByText('Heads up')).not.toBeInTheDocument();
  vi.useRealTimers();
});

test('reusing an id replaces the toast instead of stacking duplicates', async () => {
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <Trigger type="warning" message="Connection lost" id="connection" />
    </ToastProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'show warning' }));
  await user.click(screen.getByRole('button', { name: 'show warning' }));
  expect(screen.getAllByText('Connection lost')).toHaveLength(1);
});
