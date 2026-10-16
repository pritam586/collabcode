// CollabCode's Monaco themes. Monaco needs literal colors, so these repeat the editor and
// syntax tokens in styles/tokens.css (whose contrast `npm run check:contrast` verifies);
// change both together.
const DARK = {
  background: '#0b0e1a',
  foreground: '#dbe1ef',
  gutter: '#5d6784',
  gutterActive: '#c4b5fd',
  lineHighlight: '#8b5cf612',
  selection: '#8b5cf640',
  selectionInactive: '#8b5cf624',
  cursor: '#a78bfa',
  indent: '#1c2236',
  indentActive: '#2e3652',
  widget: '#151a2c',
  widgetBorder: '#262d45',
  hover: '#1c2236',
  scrollbar: '#2e365299',
  scrollbarHover: '#46507acc',
  syntax: {
    comment: '7f89a6',
    keyword: 'c4a1ff',
    function: '7cc7ff',
    string: '6ee7d8',
    number: 'fbbf72',
    property: 'f5a8cf',
    punctuation: '8f99b3',
    type: '7dd3fc',
    text: 'dbe1ef',
  },
};

const LIGHT = {
  background: '#fbfcfe',
  foreground: '#1f2537',
  gutter: '#7a8399',
  gutterActive: '#6d28d9',
  lineHighlight: '#6d28d90c',
  selection: '#6d28d92e',
  selectionInactive: '#6d28d918',
  cursor: '#6d28d9',
  indent: '#e4e8f1',
  indentActive: '#c9cfdc',
  widget: '#ffffff',
  widgetBorder: '#dadfea',
  hover: '#eceff6',
  scrollbar: '#c9cfdc99',
  scrollbarHover: '#a3abbecc',
  syntax: {
    comment: '646d84',
    keyword: '7c3aed',
    function: '1d4ed8',
    string: '0e7490',
    number: 'b45309',
    property: 'be185d',
    punctuation: '586178',
    type: '0369a1',
    text: '1f2537',
  },
};

function defineTheme(base, palette) {
  const { syntax } = palette;
  return {
    base,
    inherit: true,
    rules: [
      { token: '', foreground: syntax.text },
      { token: 'comment', foreground: syntax.comment, fontStyle: 'italic' },
      { token: 'keyword', foreground: syntax.keyword },
      { token: 'string', foreground: syntax.string },
      { token: 'string.escape', foreground: syntax.number },
      { token: 'regexp', foreground: syntax.property },
      { token: 'number', foreground: syntax.number },
      { token: 'type', foreground: syntax.type },
      { token: 'type.identifier', foreground: syntax.type },
      { token: 'identifier', foreground: syntax.text },
      { token: 'delimiter', foreground: syntax.punctuation },
      { token: 'delimiter.bracket', foreground: syntax.punctuation },
      { token: 'annotation', foreground: syntax.property },
      { token: 'tag', foreground: syntax.keyword },
      { token: 'attribute.name', foreground: syntax.property },
      { token: 'attribute.value', foreground: syntax.string },
      { token: 'key', foreground: syntax.property },
      { token: 'string.key.json', foreground: syntax.property },
      { token: 'string.value.json', foreground: syntax.string },
      { token: 'predefined', foreground: syntax.function },
    ],
    colors: {
      'editor.background': palette.background,
      'editor.foreground': palette.foreground,
      'editorGutter.background': palette.background,
      'editorLineNumber.foreground': palette.gutter,
      'editorLineNumber.activeForeground': palette.gutterActive,
      'editor.lineHighlightBackground': palette.lineHighlight,
      'editor.lineHighlightBorder': '#00000000',
      'editor.selectionBackground': palette.selection,
      'editor.inactiveSelectionBackground': palette.selectionInactive,
      'editor.selectionHighlightBackground': palette.selectionInactive,
      'editor.wordHighlightBackground': palette.selectionInactive,
      'editorCursor.foreground': palette.cursor,
      'editorIndentGuide.background1': palette.indent,
      'editorIndentGuide.activeBackground1': palette.indentActive,
      'editorWhitespace.foreground': palette.indent,
      'editorBracketMatch.background': palette.selectionInactive,
      'editorBracketMatch.border': '#00000000',
      'editorWidget.background': palette.widget,
      'editorWidget.border': palette.widgetBorder,
      'editorSuggestWidget.background': palette.widget,
      'editorSuggestWidget.border': palette.widgetBorder,
      'editorSuggestWidget.selectedBackground': palette.hover,
      'editorHoverWidget.background': palette.widget,
      'editorHoverWidget.border': palette.widgetBorder,
      'scrollbar.shadow': '#00000000',
      'scrollbarSlider.background': palette.scrollbar,
      'scrollbarSlider.hoverBackground': palette.scrollbarHover,
      'scrollbarSlider.activeBackground': palette.scrollbarHover,
      focusBorder: '#00000000',
    },
  };
}

export const EDITOR_THEMES = { dark: 'collabcode-dark', light: 'collabcode-light' };

export function registerEditorThemes(monaco) {
  monaco.editor.defineTheme(EDITOR_THEMES.dark, defineTheme('vs-dark', DARK));
  monaco.editor.defineTheme(EDITOR_THEMES.light, defineTheme('vs', LIGHT));
}
