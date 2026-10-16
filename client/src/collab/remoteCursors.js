import * as Y from 'yjs';

const COLORS = new Set(['violet', 'cyan', 'amber', 'rose', 'lime', 'sky']);
const CURSOR_SEND_DELAY_MS = 45;
const TYPING_IDLE_MS = 1500;
// A name label shrinks to a small flag after this long without the cursor moving or typing.
const LABEL_IDLE_MS = 3000;

// A CSS string literal for a display name (names never contain control characters; the
// server's schema rejects them).
const cssString = (value) => `"${String(value).replace(/["\\]/g, '\\$&')}"`;

// Publishes this editor's selection and typing state through Yjs awareness and draws
// everyone else's cursors.
// Positions are Yjs relative positions, so a cursor stays on the same character while other
// people insert or delete text before it. Names and colors come from the server (state.user).
//
// Each cursor is a zero-width marker before the character; its name is drawn by a ::after
// label (one generated CSS rule per person) that floats above the line, so it never pushes
// the code sideways the way injected text would.
export function bindRemoteCursors({ provider, editor, monaco }) {
  const { awareness, doc, text } = provider;
  const model = editor.getModel();
  const labelStyles = document.createElement('style');
  labelStyles.dataset.remoteCursorLabels = '';
  document.head.append(labelStyles);
  const lastActivity = new Map();
  let decorationIds = [];
  let sendTimer = null;
  let typingTimer = null;
  let idleTimer = null;

  const toRelative = (position) =>
    Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(text, model.getOffsetAt(position)));
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
    const now = Date.now();
    const decorations = [];
    const labelRules = [];
    const present = new Set();
    let nextIdleIn = Infinity;

    for (const [clientId, state] of awareness.getStates()) {
      if (clientId === doc.clientID || !state?.cursor || !state.user) continue;
      const anchor = toPosition(state.cursor.anchor);
      const head = toPosition(state.cursor.head);
      if (!anchor || !head) continue;
      present.add(clientId);

      const key = JSON.stringify(state.cursor);
      if (lastActivity.get(clientId)?.key !== key || state.typing) lastActivity.set(clientId, { key, at: now });
      const quietFor = now - lastActivity.get(clientId).at;
      const idle = quietFor >= LABEL_IDLE_MS;
      if (!idle) nextIdleIn = Math.min(nextIdleIn, LABEL_IDLE_MS - quietFor);

      const color = COLORS.has(state.user.color) ? state.user.color : 'violet';
      const [start, end] = monaco.Position.isBefore(anchor, head) ? [anchor, head] : [head, anchor];
      decorations.push({
        range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
        options: {
          className: `remote-selection remote-selection-${color}`,
          hoverMessage: { value: `${state.user.name}'s selection` },
        },
      });
      decorations.push({
        range: new monaco.Range(head.lineNumber, head.column, head.lineNumber, head.column),
        options: {
          // Monaco skips decorations on empty ranges (a caret) unless told otherwise.
          showIfCollapsed: true,
          beforeContentClassName: [
            'remote-cursor-marker',
            `remote-cursor-${color}`,
            `remote-cursor-client-${clientId}`,
            head.lineNumber === 1 && 'is-first-line',
            idle && 'is-idle',
          ]
            .filter(Boolean)
            .join(' '),
        },
      });
      labelRules.push(`.remote-cursor-client-${clientId}::after { content: ${cssString(state.user.name)}; }`);
    }

    for (const clientId of lastActivity.keys()) if (!present.has(clientId)) lastActivity.delete(clientId);
    const css = labelRules.join('\n');
    if (labelStyles.textContent !== css) labelStyles.textContent = css;
    decorationIds = editor.deltaDecorations(decorationIds, decorations);

    // Redraw when the next active label should go idle.
    clearTimeout(idleTimer);
    if (nextIdleIn < Infinity) idleTimer = setTimeout(render, nextIdleIn + 50);
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
      clearTimeout(idleTimer);
      selectionSubscription.dispose();
      awareness.off('change', render);
      doc.off('afterTransaction', render);
      decorationIds = editor.deltaDecorations(decorationIds, []);
      labelStyles.remove();
    },
  };
}
