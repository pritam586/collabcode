import { useEffect, useId, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from './ui/Button.jsx';
import { Shortcut } from './ui/Kbd.jsx';
import { readStorage, writeStorage } from '../lib/storage.js';

const DONE_KEY = 'collabcode-tour-done';

const STEPS = [
  { target: 'share', title: 'Invite people', body: 'Share copies a link to this room. Anyone with it can join; they only pick a name.' },
  { target: 'run', title: 'Run your code', body: <>Run JavaScript in your browser, or Python, TypeScript, Java and C++ on the server. Shortcut: <Shortcut keys="Mod+Enter" />.</> },
  { target: 'sidebar', title: 'People, chat and tasks', body: 'See who is here and who is typing, chat, and keep a shared task list.' },
  { target: 'shortcuts', title: 'Work fast', body: <>Undo only reverts your own changes. Press <Shortcut keys="?" /> any time for all shortcuts.</> },
];

// A short, skippable tour for first-time visitors. It points at real controls by outlining
// the element marked data-tour="<target>", and never shows again once finished or skipped.
export function OnboardingTour({ onOpenSidebar }) {
  const [step, setStep] = useState(() => (readStorage(DONE_KEY, false) ? -1 : 0));
  const titleId = useId();
  const current = STEPS[step];

  useEffect(() => {
    if (!current) return undefined;
    const target = document.querySelector(`[data-tour="${current.target}"]`);
    target?.classList.add('tour-highlight');
    return () => target?.classList.remove('tour-highlight');
  }, [current]);

  if (!current) return null;

  function finish() {
    writeStorage(DONE_KEY, true);
    setStep(-1);
  }

  function next() {
    if (step === STEPS.length - 1) {
      finish();
      return;
    }
    if (STEPS[step + 1].target === 'sidebar') onOpenSidebar();
    setStep(step + 1);
  }

  return (
    <section className="tour" role="dialog" aria-modal="false" aria-labelledby={titleId}>
      <p className="tour-step"><Sparkles size={14} aria-hidden="true" /> Quick tour · {step + 1} of {STEPS.length}</p>
      <h2 className="tour-title" id={titleId}>{current.title}</h2>
      <p className="tour-body">{current.body}</p>
      <div className="tour-actions">
        <Button variant="ghost" size="sm" onClick={finish}>Skip tour</Button>
        {step > 0 && <Button variant="secondary" size="sm" onClick={() => setStep(step - 1)}>Back</Button>}
        <Button variant="primary" size="sm" onClick={next}>{step === STEPS.length - 1 ? 'Done' : 'Next'}</Button>
      </div>
    </section>
  );
}
