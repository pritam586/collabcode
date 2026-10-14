import * as Y from 'yjs';

const COLORS = new Set(['violet', 'cyan', 'amber', 'rose', 'lime', 'sky']);
const CURSOR_SEND_DELAY_MS = 45;
const TYPING_IDLE_MS = 1500;

// Publishes this editor's selection and typing state through Yjs awareness and draws
// everyone else's cursors.
// Positions are Yjs relative positions, so a cursor stays on the same character while other
// people insert or delete text before it. Names and colors come from the server (state.user).
export function bindRemoteCursors({ provider, editor, monaco }) {
  const { awareness, doc, text } = provider;
  const model = editor.getModel();
  let decorationIds = [];
  let sendTimer = null;
  let typingTimer = null;

  const toRelative = (position) => Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(text, model.getOffsetAt(position)));
  const toPosition = (json) => {
    const absolute = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(json), doc);
    return absolute && absolute.type === text ? model.getPositionAt(absolute.index) : null;
  };

  const selectionSubscription = editor.onDidChangeCursorSelection(({ selection }) => {
    clearTimeout(sendTimer);
    sendTimer = setTimeout(() => {
      awareness.setLocalStateField('cursor', {
        anchor: toRelative(selection.getSelectionStart()),
        head: toRelative(selection.getPosition()),
      });
    }, CURSOR_SEND_DELAY_MS);
  });

  function render() {
    const decorations = [];
    for (const [clientId, state] of awareness.getStates()) {
      if (clientId === doc.clientID || !state?.cursor || !state.user) continue;
      const anchor = toPosition(state.cursor.anchor);
      const head = toPosition(state.cursor.head);
      if (!anchor || !head) continue;

      const color = COLORS.has(state.user.color) ? state.user.color : 'violet';
      const [start, end] = monaco.Position.isBefore(anchor, head) ? [anchor, head] : [head, anchor];
      decorations.push({
        range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
        options: { className: `remote-selection remote-selection-${color}`, hoverMessage: { value: `${state.user.name}'s selection` } },
      });
      decorations.push({
        range: new monaco.Range(head.lineNumber, head.column, head.lineNumber, head.column),
        options: {
          // Monaco skips decorations on empty ranges (a caret) unless told otherwise.
          showIfCollapsed: true,
          beforeContentClassName: `remote-cursor-marker remote-cursor-${color}`,
          after: { content: ` ${state.user.name}`, inlineClassName: `remote-cursor-tag remote-tag-${color}` },
        },
      });
    }
    decorationIds = editor.deltaDecorations(decorationIds, decorations);
  }

  awareness.on('change', render);
  // Text changes move absolute positions even when nobody moves their cursor.
  doc.on('afterTransaction', render);
  render();

  // Called for each local edit. Only state changes are sent, not every keystroke.
  function markTyping() {
    if (!awareness.getLocalState()?.typing) awareness.setLocalStateField('typing', true);
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => awareness.setLocalStateField('typing', false), TYPING_IDLE_MS);
  }

  return {
    markTyping,
    destroy() {
      clearTimeout(sendTimer);
      clearTimeout(typingTimer);
      selectionSubscription.dispose();
      awareness.off('change', render);
      doc.off('afterTransaction', render);
      decorationIds = editor.deltaDecorations(decorationIds, []);
    },
  };
}
