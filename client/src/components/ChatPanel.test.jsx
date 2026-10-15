import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { ChatPanel } from './ChatPanel.jsx';

const message = (id, name, body, socketId = `${name}-socket`) => ({
  id,
  author: { name, color: 'cyan', socketId },
  body,
  createdAt: Date.UTC(2026, 9, 15, 9, 30) + id * 1000,
});

function renderChat(props = {}) {
  const onSend = vi.fn();
  const onDiscard = vi.fn();
  render(
    <ChatPanel
      messages={[]}
      pendingMessages={[]}
      selfSocketId="me"
      onSend={onSend}
      onDiscard={onDiscard}
      isVisible
      {...props}
    />,
  );
  return { onSend, onDiscard, input: screen.getByLabelText('Message the room') };
}

describe('ChatPanel', () => {
  test('shows an empty state before the first message', () => {
    renderChat();
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
  });

  test('Enter sends the trimmed message and clears the box; Shift+Enter adds a line', async () => {
    const user = userEvent.setup();
    const { onSend, input } = renderChat();

    await user.type(input, 'first line{Shift>}{Enter}{/Shift}second line');
    expect(onSend).not.toHaveBeenCalled();
    expect(input).toHaveValue('first line\nsecond line');

    await user.type(input, '  {Enter}');
    expect(onSend).toHaveBeenCalledWith('first line\nsecond line');
    expect(input).toHaveValue('');
  });

  test('does not send blank messages', async () => {
    const user = userEvent.setup();
    const { onSend, input } = renderChat();
    await user.type(input, '   {Enter}');
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });

  test('labels your own messages and groups consecutive ones', () => {
    renderChat({
      messages: [message(1, 'Grace', 'Hi!'), message(2, 'Grace', 'Ready?'), message(3, 'Ada', 'Yes', 'me')],
    });
    expect(screen.getAllByText('Grace')).toHaveLength(1);
    expect(screen.getByText('Ada (you)')).toBeInTheDocument();
  });

  test('offers retry and discard for messages that failed to send', async () => {
    const user = userEvent.setup();
    const { onSend, onDiscard } = renderChat({
      pendingMessages: [{ clientId: 'c1', body: 'lost message', status: 'failed', createdAt: 0 }],
    });
    expect(screen.getByText('Not sent.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try sending again' }));
    expect(onSend).toHaveBeenCalledWith('lost message', 'c1');
    await user.click(screen.getByRole('button', { name: 'Discard message' }));
    expect(onDiscard).toHaveBeenCalledWith('c1');
  });
});
