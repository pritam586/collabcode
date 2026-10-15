import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, test } from 'vitest';
import { Tabs } from './Tabs.jsx';

function Example() {
  const [selected, setSelected] = useState('people');
  return (
    <Tabs
      label="Sidebar"
      selectedId={selected}
      onSelect={setSelected}
      tabs={[
        { id: 'people', label: 'People', content: <p>People panel</p> },
        { id: 'chat', label: 'Chat', content: <p>Chat panel</p> },
        { id: 'tasks', label: 'Tasks', content: <p>Tasks panel</p> },
      ]}
    />
  );
}

test('arrow keys, Home and End move between tabs and their panels', async () => {
  const user = userEvent.setup();
  render(<Example />);
  const people = screen.getByRole('tab', { name: 'People' });
  expect(people).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('Chat panel')).not.toBeVisible();

  await user.click(people);
  await user.keyboard('{ArrowRight}');
  const chat = screen.getByRole('tab', { name: 'Chat' });
  expect(chat).toHaveFocus();
  expect(chat).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tabpanel', { name: 'Chat' })).toBeVisible();

  await user.keyboard('{End}');
  expect(screen.getByRole('tab', { name: 'Tasks' })).toHaveFocus();
  await user.keyboard('{ArrowRight}');
  expect(people).toHaveFocus();
});

test('only the selected tab is in the Tab order', () => {
  render(<Example />);
  expect(screen.getByRole('tab', { name: 'People' })).toHaveAttribute('tabindex', '0');
  expect(screen.getByRole('tab', { name: 'Chat' })).toHaveAttribute('tabindex', '-1');
});
