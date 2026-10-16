import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from './Button.jsx';
import { writeToClipboard } from '../../lib/clipboard.js';

const COPIED_MS = 2000;

// Copies `text` and confirms in place: the icon becomes a check and the label "Copied!" for two
// seconds, and a status message tells screen readers. Both labels share one grid cell, so the
// button keeps its width while they swap. If the browser refuses (insecure page, blocked
// permission), a hidden-textarea copy is tried, then `onCopyFailed` is called.
export function CopyButton({
  text,
  label = 'Copy link',
  copiedLabel = 'Copied!',
  announcement = 'Copied to the clipboard',
  variant = 'secondary',
  size = 'md',
  block = false,
  onCopied,
  onCopyFailed,
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  async function copy() {
    const ok = await writeToClipboard(text);
    if (!ok) {
      onCopyFailed?.();
      return;
    }
    clearTimeout(timerRef.current);
    setCopied(true);
    onCopied?.();
    timerRef.current = setTimeout(() => setCopied(false), COPIED_MS);
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        block={block}
        className={copied ? 'copy-btn is-copied' : 'copy-btn'}
        icon={
          <span className="copy-icon" aria-hidden="true">
            {copied ? <Check key="done" size={16} /> : <Copy key="copy" size={16} />}
          </span>
        }
        onClick={copy}
      >
        <span className="copy-labels">
          <span aria-hidden={copied || undefined}>{label}</span>
          <span aria-hidden={!copied || undefined}>{copiedLabel}</span>
        </span>
      </Button>
      <span className="sr-only" role="status">
        {copied ? announcement : ''}
      </span>
    </>
  );
}
