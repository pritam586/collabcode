import { describe, expect, test } from 'vitest';
import { generateRoomId, parseRoomInput, ROOM_ID_PATTERN, roomPath } from './rooms.js';

describe('generateRoomId', () => {
  test('makes readable codes that the server accepts', () => {
    for (let index = 0; index < 50; index += 1) {
      const id = generateRoomId();
      expect(id).toMatch(/^[a-z]+-[a-z]+-\d{4}$/);
      expect(id).toMatch(ROOM_ID_PATTERN);
    }
  });

  test('rarely repeats', () => {
    const ids = new Set(Array.from({ length: 200 }, generateRoomId));
    expect(ids.size).toBeGreaterThan(190);
  });
});

describe('parseRoomInput', () => {
  test.each([
    ['swift-otter-4821', 'swift-otter-4821'],
    ['  team.alpha_1  ', 'team.alpha_1'],
    ['https://collab.example.com/r/swift-otter-4821', 'swift-otter-4821'],
    ['http://localhost:5173/r/my-room?ref=chat#top', 'my-room'],
    ['/r/space%20room', null],
    ['', null],
    ['-starts-with-dash', null],
    ['has spaces', null],
    ['https://example.com/no-room-here', null],
  ])('%j -> %j', (input, expected) => {
    expect(parseRoomInput(input)).toBe(expected);
  });
});

test('roomPath encodes the code', () => {
  expect(roomPath('swift-otter-4821')).toBe('/r/swift-otter-4821');
});
