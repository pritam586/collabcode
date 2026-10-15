import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { Menu } from './Menu.jsx';

function setup({ wrap = false } = {}) {
  const copy = vi.fn();
  const remove = vi.fn();
  const toggle = vi.fn();
  render(
    <Menu
      label="Room actions"
      icon={<span>…</span>}
      items={[
        { id: 'copy', label: 'Copy link', onSelect: copy },
        { id: 'wrap', label: 'Wrap lines', checked: wrap, onSelect: toggle },
        { id: 'sep', type: 'separator' },
        { id: 'delete', label: 'Delete room', danger: true, onSelect: remove },
      ]}
    />,
  );
  return {
    user: userEvent.setup(),
    copy,
    remove,
    toggle,
    trigger: screen.getByRole('button', { name: 'Room actions' }),
  };
}

test('opens on click with focus on the first item, and arrows wrap around', async () => {
  const { user, trigger } = setup();
  expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  expect(trigger).toHaveAttribute('aria-expanded', 'false');

  await user.click(trigger);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('menu', { name: 'Room actions' })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: 'Copy link' })).toHaveFocus();

  await user.keyboard('{ArrowUp}');
  expect(screen.getByRole('menuitem', { name: 'Delete room' })).toHaveFocus();
  await user.keyboard('{ArrowDown}');
  expect(screen.getByRole('menuitem', { name: 'Copy link' })).toHaveFocus();
  await user.keyboard('w');
  expect(screen.getByRole('menuitemcheckbox', { name: 'Wrap lines' })).toHaveFocus();
});

test('ArrowUp on the trigger opens at the last item; Escape closes and returns focus', async () => {
  const { user, trigger } = setup();
  trigger.focus();
  await user.keyboard('{ArrowUp}');
  expect(screen.getByRole('menuitem', { name: 'Delete room' })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

test('choosing an item runs it, closes the menu and returns focus', async () => {
  const { user, trigger, copy } = setup();
  await user.click(trigger);
  await user.keyboard('{Enter}');
  expect(copy).toHaveBeenCalledOnce();
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

test('checkbox items report their state', async () => {
  const { user, trigger } = setup({ wrap: true });
  await user.click(trigger);
  expect(screen.getByRole('menuitemcheckbox', { name: 'Wrap lines' })).toHaveAttribute('aria-checked', 'true');
});

test('a click outside closes the menu', async () => {
  const { user, trigger } = setup();
  await user.click(trigger);
  await user.click(document.body);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});
