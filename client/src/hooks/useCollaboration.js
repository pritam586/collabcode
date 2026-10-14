import { useCallback, useEffect, useState } from 'react';
import * as Y from 'yjs';
import { createId } from '../lib/storage.js';

export const MAX_TASKS = 200;
export const MAX_TASK_LENGTH = 300;

// Who is typing, keyed by socket id, from Yjs awareness (the server sets state.user).
export function usePresence(provider) {
  const [typingSocketIds, setTypingSocketIds] = useState(() => new Set());

  useEffect(() => {
    if (!provider) return undefined;
    const { awareness, doc } = provider;
    const update = () => {
      const next = new Set();
      for (const [clientId, state] of awareness.getStates()) {
        if (clientId !== doc.clientID && state?.typing && state.user?.socketId) next.add(state.user.socketId);
      }
      setTypingSocketIds((current) => (sameSet(current, next) ? current : next));
    };
    update();
    awareness.on('change', update);
    return () => awareness.off('change', update);
  }, [provider]);

  return typingSocketIds;
}

// The room's shared task list: a Y.Array of Y.Maps in the same Yjs document as the code, so
// tasks sync, persist and merge offline edits exactly like the code does.
export function useTasks(provider) {
  const [tasks, setTasks] = useState([]);
  const yTasks = provider?.doc.getArray('tasks');

  useEffect(() => {
    if (!yTasks) return undefined;
    const update = () => setTasks(yTasks.toArray().map((task) => ({
      id: task.get('id'),
      text: task.get('text'),
      done: Boolean(task.get('done')),
      createdBy: task.get('createdBy'),
    })).filter((task) => typeof task.id === 'string' && typeof task.text === 'string'));
    update();
    yTasks.observeDeep(update);
    return () => yTasks.unobserveDeep(update);
  }, [yTasks]);

  const findTask = useCallback((id) => yTasks?.toArray().find((task) => task.get('id') === id), [yTasks]);

  const addTask = useCallback((text, createdBy) => {
    const value = text.trim().slice(0, MAX_TASK_LENGTH);
    if (!yTasks || !value || yTasks.length >= MAX_TASKS) return false;
    const task = new Y.Map();
    yTasks.doc.transact(() => {
      task.set('id', createId());
      task.set('text', value);
      task.set('done', false);
      task.set('createdBy', createdBy);
      yTasks.push([task]);
    });
    return true;
  }, [yTasks]);

  const toggleTask = useCallback((id) => {
    const task = findTask(id);
    task?.set('done', !task.get('done'));
  }, [findTask]);

  const renameTask = useCallback((id, text) => {
    const value = text.trim().slice(0, MAX_TASK_LENGTH);
    if (value) findTask(id)?.set('text', value);
  }, [findTask]);

  const removeTask = useCallback((id) => {
    if (!yTasks) return;
    const index = yTasks.toArray().findIndex((task) => task.get('id') === id);
    if (index >= 0) yTasks.delete(index, 1);
  }, [yTasks]);

  return { tasks, addTask, toggleTask, renameTask, removeTask };
}

function sameSet(a, b) {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}
