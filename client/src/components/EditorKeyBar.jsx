import { Redo2, Undo2 } from 'lucide-react';

// Touch keyboards hide the characters code needs most. This bar sits above the keyboard and
// types them into Monaco. Buttons do not take focus (pointerdown is cancelled), so the
// on-screen keyboard stays open and the cursor stays where it was.
const KEYS = [
  { label: 'Tab', run: (editor) => editor.trigger('keyboard', 'tab', null), name: 'Indent' },
  ...['{', '}', '(', ')', '[', ']', ';', '=', ':', '"', "'", '<', '>', '/', '+', '-', '_'].map((text) => ({
    label: text,
    name: `Type ${text}`,
    run: (editor) => editor.trigger('keyboard', 'type', { text }),
  })),
];

export function EditorKeyBar({ editor }) {
  const keepFocus = (event) => event.preventDefault();
  const press = (run) => {
    run(editor);
    editor.focus();
  };

  return (
    <div className="key-bar" role="group" aria-label="Code symbols" onPointerDown={keepFocus}>
      <button type="button" className="key-bar-key" aria-label="Undo my last change" onClick={() => press((instance) => instance.getAction('collabcode.undo')?.run())}><Undo2 size={16} aria-hidden="true" /></button>
      <button type="button" className="key-bar-key" aria-label="Redo my last change" onClick={() => press((instance) => instance.getAction('collabcode.redo')?.run())}><Redo2 size={16} aria-hidden="true" /></button>
      {KEYS.map(({ label, name, run }) => (
        <button key={label} type="button" className="key-bar-key" aria-label={name} onClick={() => press(run)}>{label}</button>
      ))}
    </div>
  );
}
