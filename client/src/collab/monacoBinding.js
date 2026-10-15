import * as Y from 'yjs';

// Keeps a Monaco model and a Y.Text identical in both directions, the same approach as the
// y-monaco package. It is written here because y-monaco imports the full monaco-editor entry
// (every language), while the app bundles only the languages it offers (editor/monacoSetup.js).
//
// Undo and redo go through a Y.UndoManager that only tracks this editor's own edits, so
// Ctrl+Z never reverts something a collaborator typed.
export function bindMonacoToYText({ ytext, editor, monaco, onLocalChange }) {
  const model = editor.getModel();
  const origin = { binding: 'monaco' };
  let applyingRemote = false;

  function withoutEcho(apply) {
    applyingRemote = true;
    try {
      apply();
    } finally {
      applyingRemote = false;
    }
  }

  // Monaco offsets must match Y.Text offsets, so line breaks must be a single \n. setValue
  // picks the platform default (CRLF on Windows), so the EOL is set after it, and reset if
  // anything changes it later.
  const keepLf = () => {
    if (model.getEOL() !== '\n') withoutEcho(() => model.setEOL(monaco.editor.EndOfLineSequence.LF));
  };
  withoutEcho(() => {
    if (model.getValue() !== ytext.toString()) model.setValue(ytext.toString());
  });
  keepLf();

  const handleYTextChange = (event, transaction) => {
    if (transaction.origin === origin) return;
    withoutEcho(() => {
      let index = 0;
      for (const operation of event.delta) {
        if (operation.retain !== undefined) {
          index += operation.retain;
        } else if (operation.insert !== undefined) {
          const position = model.getPositionAt(index);
          const range = new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column);
          model.applyEdits([{ range, text: operation.insert }]);
          index += operation.insert.length;
        } else if (operation.delete !== undefined) {
          const start = model.getPositionAt(index);
          const end = model.getPositionAt(index + operation.delete);
          model.applyEdits([{ range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column), text: '' }]);
        }
      }
    });
  };
  ytext.observe(handleYTextChange);

  const contentSubscription = model.onDidChangeContent((event) => {
    if (applyingRemote) return;
    if (model.getEOL() !== '\n') {
      keepLf();
      return;
    }
    // Apply from the end of the document backwards so earlier offsets stay valid.
    const changes = [...event.changes].sort((a, b) => b.rangeOffset - a.rangeOffset);
    ytext.doc.transact(() => {
      for (const change of changes) {
        if (change.rangeLength > 0) ytext.delete(change.rangeOffset, change.rangeLength);
        // Y.Text never holds \r (see keepLf). Monaco should not produce one, but be certain.
        const text = change.text.replace(/\r\n?/g, '\n');
        if (text) ytext.insert(change.rangeOffset, text);
      }
    }, origin);
    onLocalChange?.();
  });

  const undoManager = new Y.UndoManager(ytext, { trackedOrigins: new Set([origin]) });
  const { KeyMod, KeyCode } = monaco;
  // Actions (unlike addCommand) can be disposed, so a rebind after a reset replaces them.
  const undoAction = editor.addAction({
    id: 'collabcode.undo',
    label: 'Undo my last change',
    keybindings: [KeyMod.CtrlCmd | KeyCode.KeyZ],
    run: () => undoManager.undo(),
  });
  const redoAction = editor.addAction({
    id: 'collabcode.redo',
    label: 'Redo my last change',
    keybindings: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyZ, KeyMod.CtrlCmd | KeyCode.KeyY],
    run: () => undoManager.redo(),
  });

  return {
    destroy() {
      ytext.unobserve(handleYTextChange);
      contentSubscription.dispose();
      undoAction.dispose();
      redoAction.dispose();
      undoManager.destroy();
    },
  };
}
