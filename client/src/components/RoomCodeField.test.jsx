import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test } from 'vitest';
import { RoomCodeField } from './RoomCodeField.jsx';
import { formatRoomCode } from '../lib/rooms.js';

describe('formatRoomCode', () => {
  test('turns spaces into dashes', () => {
    expect(formatRoomCode('swift otter  4821')).toBe('swift-otter-4821');
    expect(formatRoomCode('  swift')).toBe('swift');
  });
  test('keeps case, dots and underscores, which are valid in codes', () => {
    expect(formatRoomCode('Team.Room_2')).toBe('Team.Room_2');
  });
  test('leaves links alone while they are typed', () => {
    expect(formatRoomCode('https://example.com/r/a b')).toBe('https://example.com/r/a b');
  });
});

function Example() {
  const [value, setValue] = useState('');
  return <RoomCodeField value={value} onChange={setValue} />;
}

test('says when the input names a room', async () => {
  const user = userEvent.setup();
  render(<Example />);
  const field = screen.getByLabelText('Room code or invite link');
  await user.type(field, 'swift otter 4821');
  expect(field).toHaveValue('swift-otter-4821');
  expect(field).toHaveAccessibleDescription(/Ready to join swift-otter-4821/);
});

test('a pasted invite link is replaced by its room code', async () => {
  const user = userEvent.setup();
  render(<Example />);
  const field = screen.getByLabelText('Room code or invite link');
  await user.click(field);
  await user.paste('https://collab.example.com/r/swift-otter-4821?from=chat');
  expect(field).toHaveValue('swift-otter-4821');
});

test('a typed link becomes its room code when the field loses focus', async () => {
  const user = userEvent.setup();
  render(<Example />);
  const field = screen.getByLabelText('Room code or invite link');
  await user.type(field, 'https://collab.example.com/r/calm-fox-1234');
  await user.tab();
  expect(field).toHaveValue('calm-fox-1234');
});
