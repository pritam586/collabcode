import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { JoinScreen } from './JoinScreen.jsx';

function renderJoin() {
  const onJoin = vi.fn();
  const onCancel = vi.fn();
  render(<JoinScreen roomId="swift-otter-4821" onJoin={onJoin} onCancel={onCancel} />);
  return { onJoin, onCancel, user: userEvent.setup() };
}

test('names the room and starts with the name field focused', () => {
  renderJoin();
  expect(screen.getByRole('region', { name: 'Join this room' })).toBeInTheDocument();
  expect(screen.getByLabelText('Room code swift-otter-4821')).toBeInTheDocument();
  expect(screen.getByLabelText('Your name')).toHaveFocus();
});

test('joins with the chosen name and remembers it', async () => {
  const { onJoin, user } = renderJoin();
  const name = screen.getByLabelText('Your name');
  await user.clear(name);
  await user.type(name, 'Grace');
  await user.click(screen.getByRole('button', { name: 'Join room' }));
  expect(onJoin).toHaveBeenCalledWith('Grace');
  expect(JSON.parse(window.localStorage.getItem('collabcode-name'))).toBe('Grace');
});

test('requires a name', async () => {
  const { onJoin, user } = renderJoin();
  await user.clear(screen.getByLabelText('Your name'));
  await user.click(screen.getByRole('button', { name: 'Join room' }));
  expect(onJoin).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a name');
});

test('copies the invite link for passing it on', async () => {
  const { user } = renderJoin();
  await user.click(screen.getByRole('button', { name: 'Copy invite link' }));
  expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/r/swift-otter-4821`);
  expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
});

test('Back to home leaves', async () => {
  const { onCancel, user } = renderJoin();
  await user.click(screen.getByRole('button', { name: 'Back to home' }));
  expect(onCancel).toHaveBeenCalled();
});
