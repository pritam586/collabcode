import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, test } from 'vitest';
import { ResizeHandle } from './ResizeHandle.jsx';

function Example({ invert = false }) {
  const [size, setSize] = useState(300);
  return (
    <ResizeHandle
      label="Resize sidebar"
      value={size}
      min={200}
      max={500}
      invert={invert}
      onChange={setSize}
      onReset={() => setSize(300)}
    />
  );
}

test('is a focusable separator that reports its size', () => {
  render(<Example />);
  const handle = screen.getByRole('separator', { name: 'Resize sidebar' });
  expect(handle).toHaveAttribute('tabindex', '0');
  expect(handle).toHaveAttribute('aria-valuenow', '300');
  expect(handle).toHaveAttribute('aria-valuemin', '200');
  expect(handle).toHaveAttribute('aria-valuemax', '500');
});

test('arrow keys resize in steps, Shift in bigger ones, within the limits', async () => {
  const user = userEvent.setup();
  render(<Example />);
  const handle = screen.getByRole('separator');
  handle.focus();
  await user.keyboard('{ArrowRight}');
  expect(handle).toHaveAttribute('aria-valuenow', '316');
  await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
  expect(handle).toHaveAttribute('aria-valuenow', '252');
  await user.keyboard('{End}');
  expect(handle).toHaveAttribute('aria-valuenow', '500');
  await user.keyboard('{ArrowRight}');
  expect(handle).toHaveAttribute('aria-valuenow', '500');
  await user.keyboard('{Home}{Enter}');
  expect(handle).toHaveAttribute('aria-valuenow', '300');
});

test('a panel on the right grows as the divider moves left', async () => {
  const user = userEvent.setup();
  render(<Example invert />);
  const handle = screen.getByRole('separator');
  handle.focus();
  await user.keyboard('{ArrowLeft}');
  expect(handle).toHaveAttribute('aria-valuenow', '316');
});
