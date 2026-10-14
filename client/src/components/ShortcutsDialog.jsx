import { Modal } from './ui/Modal.jsx';
import { Shortcut } from './ui/Kbd.jsx';

const SHORTCUTS = [
  { keys: 'Mod+Enter', action: 'Run the code' },
  { keys: 'Mod+/', action: 'Comment or uncomment the selected lines' },
  { keys: 'Mod+Z', action: 'Undo your last change (never someone else’s)' },
  { keys: 'Mod+Shift+Z', action: 'Redo your last undone change' },
  { keys: 'Mod+F', action: 'Find in the file' },
  { keys: 'Alt+Up', action: 'Move the line up (Alt+Down moves it down)' },
  { keys: 'F1', action: 'Open the editor command palette' },
  { keys: 'Enter', action: 'Send a chat message (Shift+Enter for a new line)' },
  { keys: '?', action: 'Show these shortcuts (outside the editor)' },
];

export function ShortcutsDialog({ open, onClose }) {
  return (
    <Modal open={open} title="Keyboard shortcuts" onClose={onClose}>
      <table className="shortcut-table">
        <caption className="sr-only">Keyboard shortcuts</caption>
        <thead className="sr-only">
          <tr><th scope="col">Keys</th><th scope="col">Action</th></tr>
        </thead>
        <tbody>
          {SHORTCUTS.map(({ keys, action }) => (
            <tr key={keys}>
              <td><Shortcut keys={keys} /></td>
              <td>{action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
