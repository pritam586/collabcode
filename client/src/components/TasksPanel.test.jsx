import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Awareness } from 'y-protocols/awareness';
import { expect, test } from 'vitest';
import * as Y from 'yjs';
import { TasksPanel } from './TasksPanel.jsx';
import { useTasks } from '../hooks/useCollaboration.js';

function TasksWithDoc({ provider }) {
  const taskList = useTasks(provider);
  return <TasksPanel taskList={taskList} name="Ada" />;
}

test('adds, ticks, edits and deletes tasks through the shared document', async () => {
  const user = userEvent.setup();
  const doc = new Y.Doc();
  const provider = { doc, awareness: new Awareness(doc) };
  render(<TasksWithDoc provider={provider} />);
  expect(screen.getByText('No tasks yet')).toBeInTheDocument();

  await user.type(screen.getByLabelText('New task'), 'Write the tokenizer{Enter}');
  expect(screen.getByText('0 of 1 done')).toBeInTheDocument();
  expect(doc.getArray('tasks').length).toBe(1);

  await user.click(screen.getByRole('checkbox', { name: 'Write the tokenizer' }));
  expect(screen.getByText('1 of 1 done')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Edit task: Write the tokenizer' }));
  const editField = screen.getByLabelText('Edit task');
  expect(editField).toHaveFocus();
  await user.clear(editField);
  await user.type(editField, 'Write the lexer{Enter}');
  expect(screen.getByRole('checkbox', { name: 'Write the lexer' })).toBeChecked();

  await user.click(screen.getByRole('button', { name: 'Delete task: Write the lexer' }));
  expect(screen.getByText('No tasks yet')).toBeInTheDocument();
});

test('Escape cancels an edit', async () => {
  const user = userEvent.setup();
  const doc = new Y.Doc();
  const provider = { doc, awareness: new Awareness(doc) };
  const { result } = renderHook(() => useTasks(provider));
  result.current.addTask('Keep me', 'Ada');
  render(<TasksWithDoc provider={provider} />);

  await user.click(screen.getByRole('button', { name: 'Edit task: Keep me' }));
  await user.type(screen.getByLabelText('Edit task'), ' changed{Escape}');
  expect(screen.getByRole('checkbox', { name: 'Keep me' })).toBeInTheDocument();
});
