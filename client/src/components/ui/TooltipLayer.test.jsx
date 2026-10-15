import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { TooltipLayer } from './TooltipLayer.jsx';

function Example() {
  return (
    <>
      <TooltipLayer />
      <button type="button" aria-label="Share" data-tooltip="Share">
        S
      </button>
      <button type="button" data-tooltip="Run the code" data-shortcut="Mod+Enter">
        Run
      </button>
    </>
  );
}

test('keyboard focus shows the tooltip and Escape dismisses it', async () => {
  const user = userEvent.setup();
  render(<Example />);
  await user.tab();
  expect(screen.getByRole('tooltip')).toHaveTextContent('Share');
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

test('a tooltip that adds to the name describes its control; one that repeats it does not', async () => {
  const user = userEvent.setup();
  render(<Example />);
  await user.tab();
  expect(screen.getByRole('button', { name: 'Share' })).not.toHaveAttribute('aria-describedby');

  await user.tab();
  const run = screen.getByRole('button', { name: 'Run' });
  expect(screen.getByRole('tooltip')).toHaveTextContent('Run the code');
  expect(run).toHaveAccessibleDescription(/Run the code/);

  await user.tab();
  expect(run).not.toHaveAttribute('aria-describedby');
});
