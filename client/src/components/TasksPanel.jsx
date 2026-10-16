import { useEffect, useRef, useState } from 'react';
import { Check, ListChecks, Pencil, Plus, Trash2, X } from 'lucide-react';
import { IconButton } from './ui/Button.jsx';
import { EmptyState } from './ui/Feedback.jsx';
import { MAX_TASK_LENGTH, MAX_TASKS } from '../hooks/useCollaboration.js';

export function TasksPanel({ taskList, name }) {
  const { tasks, addTask, toggleTask, renameTask, removeTask } = taskList;
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const editInputRef = useRef(null);

  // Clicking "Edit" swaps the row for a text field; move focus into it so typing works at once.
  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);
  const doneCount = tasks.filter((task) => task.done).length;
  const atLimit = tasks.length >= MAX_TASKS;

  function submit(event) {
    event.preventDefault();
    if (addTask(draft, name)) setDraft('');
  }

  function startEditing(task) {
    setEditingId(task.id);
    setEditText(task.text);
  }

  function finishEditing(save) {
    if (save) renameTask(editingId, editText);
    setEditingId(null);
  }

  return (
    <div className="panel tasks-panel">
      <form className="task-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="task-input">
          New task
        </label>
        <input
          id="task-input"
          className="input"
          placeholder={atLimit ? `Limit of ${MAX_TASKS} tasks reached` : 'Add a task…'}
          maxLength={MAX_TASK_LENGTH}
          value={draft}
          disabled={atLimit}
          onChange={(event) => setDraft(event.target.value)}
        />
        <IconButton type="submit" label="Add task" disabled={!draft.trim() || atLimit}>
          <Plus size={18} aria-hidden="true" />
        </IconButton>
      </form>

      {tasks.length > 0 && (
        <div className="task-progress">
          <span>
            {doneCount} of {tasks.length} done
          </span>
          <progress max={tasks.length} value={doneCount} aria-label="Tasks completed" />
        </div>
      )}

      {tasks.length === 0 ? (
        <EmptyState icon={ListChecks} title="No tasks yet">
          Write down what the room is working on. Everyone sees the same list.
        </EmptyState>
      ) : (
        <ul className="task-list stagger" aria-label="Tasks">
          {tasks.map((task, index) => (
            <li key={task.id} className={`task ${task.done ? 'is-done' : ''}`} style={{ '--i': index }}>
              {editingId === task.id ? (
                <form
                  className="task-edit"
                  onSubmit={(event) => {
                    event.preventDefault();
                    finishEditing(true);
                  }}
                >
                  <label className="sr-only" htmlFor={`task-edit-${task.id}`}>
                    Edit task
                  </label>
                  <input
                    id={`task-edit-${task.id}`}
                    className="input"
                    value={editText}
                    maxLength={MAX_TASK_LENGTH}
                    ref={editInputRef}
                    onChange={(event) => setEditText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') finishEditing(false);
                    }}
                  />
                  <IconButton type="submit" size="sm" label="Save task">
                    <Check size={14} aria-hidden="true" />
                  </IconButton>
                  <IconButton size="sm" label="Cancel editing" onClick={() => finishEditing(false)}>
                    <X size={14} aria-hidden="true" />
                  </IconButton>
                </form>
              ) : (
                <>
                  <label className="task-check">
                    <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)} />
                    <span className="task-text">{task.text}</span>
                  </label>
                  {task.createdBy && (
                    <span className="task-owner" data-tooltip={`Added by ${task.createdBy}`}>
                      {task.createdBy}
                    </span>
                  )}
                  <IconButton size="sm" label={`Edit task: ${task.text}`} onClick={() => startEditing(task)}>
                    <Pencil size={14} aria-hidden="true" />
                  </IconButton>
                  <IconButton size="sm" label={`Delete task: ${task.text}`} onClick={() => removeTask(task.id)}>
                    <Trash2 size={14} aria-hidden="true" />
                  </IconButton>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
