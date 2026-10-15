import { act, renderHook } from '@testing-library/react';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';
import { describe, expect, test } from 'vitest';
import * as Y from 'yjs';
import { MAX_TASK_LENGTH, MAX_TASKS, usePresence, useTasks } from './useCollaboration.js';

function createProvider() {
  const doc = new Y.Doc();
  return { doc, awareness: new Awareness(doc) };
}

describe('useTasks', () => {
  test('adds, ticks, renames and removes tasks', () => {
    const provider = createProvider();
    const { result } = renderHook(() => useTasks(provider));

    act(() => {
      result.current.addTask('  Write the tokenizer  ', 'Ada');
    });
    expect(result.current.tasks).toMatchObject([{ text: 'Write the tokenizer', done: false, createdBy: 'Ada' }]);

    const { id } = result.current.tasks[0];
    act(() => result.current.toggleTask(id));
    expect(result.current.tasks[0].done).toBe(true);

    act(() => result.current.renameTask(id, 'Write the lexer'));
    expect(result.current.tasks[0].text).toBe('Write the lexer');

    act(() => result.current.removeTask(id));
    expect(result.current.tasks).toEqual([]);
  });

  test('ignores empty tasks, trims long ones and stops at the limit', () => {
    const provider = createProvider();
    const { result } = renderHook(() => useTasks(provider));

    act(() => {
      expect(result.current.addTask('   ', 'Ada')).toBe(false);
      result.current.addTask('x'.repeat(MAX_TASK_LENGTH + 50), 'Ada');
    });
    expect(result.current.tasks[0].text).toHaveLength(MAX_TASK_LENGTH);

    act(() => {
      for (let index = 1; index < MAX_TASKS; index += 1) result.current.addTask(`task ${index}`, 'Ada');
    });
    act(() => {
      expect(result.current.addTask('one too many', 'Ada')).toBe(false);
    });
    expect(result.current.tasks).toHaveLength(MAX_TASKS);
  });

  test('shows tasks added by someone else', () => {
    const provider = createProvider();
    const { result } = renderHook(() => useTasks(provider));

    const otherDoc = new Y.Doc();
    const task = new Y.Map();
    otherDoc.transact(() => {
      task.set('id', 'remote-1');
      task.set('text', 'Review the parser');
      task.set('done', false);
      otherDoc.getArray('tasks').push([task]);
    });
    act(() => Y.applyUpdate(provider.doc, Y.encodeStateAsUpdate(otherDoc)));

    expect(result.current.tasks.map((item) => item.text)).toEqual(['Review the parser']);
  });
});

describe('usePresence', () => {
  test('lists the socket ids of people who are typing, but not yourself', () => {
    const provider = createProvider();
    provider.awareness.setLocalState({ typing: true, user: { socketId: 'me' } });
    const { result } = renderHook(() => usePresence(provider));
    expect(result.current.size).toBe(0);

    const remote = new Awareness(new Y.Doc());
    remote.setLocalState({ typing: true, user: { socketId: 'grace-socket', name: 'Grace' } });
    act(() => applyAwarenessUpdate(provider.awareness, encodeAwarenessUpdate(remote, [remote.clientID]), 'remote'));
    expect([...result.current]).toEqual(['grace-socket']);

    remote.setLocalState({ typing: false, user: { socketId: 'grace-socket', name: 'Grace' } });
    act(() => applyAwarenessUpdate(provider.awareness, encodeAwarenessUpdate(remote, [remote.clientID]), 'remote'));
    expect(result.current.size).toBe(0);
    remote.destroy();
  });
});
