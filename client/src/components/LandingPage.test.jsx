import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { LandingPage } from './LandingPage.jsx';

function renderLanding() {
  const navigate = vi.fn();
  render(<LandingPage navigate={navigate} themeControls={{ preference: 'system', setPreference: vi.fn() }} />);
  return { navigate, user: userEvent.setup() };
}

describe('LandingPage', () => {
  test('creates a room in one click with the chosen name', async () => {
    const { navigate, user } = renderLanding();
    const name = screen.getByLabelText('Your name');
    await user.clear(name);
    await user.type(name, 'Ada Lovelace');
    await user.click(screen.getByRole('button', { name: 'Create a room' }));

    expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/r\/[a-z]+-[a-z]+-\d{4}$/), {
      state: { name: 'Ada Lovelace' },
    });
    expect(JSON.parse(window.localStorage.getItem('collabcode-name'))).toBe('Ada Lovelace');
  });

  test('suggests a guest name so nobody has to type one', () => {
    renderLanding();
    expect(screen.getByLabelText('Your name').value).toMatch(/^Guest \d{4}$/);
  });

  test('joins from a pasted invite link', async () => {
    const { navigate, user } = renderLanding();
    await user.type(screen.getByLabelText('Room code or invite link'), 'https://collab.example.com/r/swift-otter-4821');
    await user.click(screen.getByRole('button', { name: 'Join room' }));
    expect(navigate).toHaveBeenCalledWith('/r/swift-otter-4821', expect.anything());
  });

  test('explains what is wrong with an invalid code', async () => {
    const { navigate, user } = renderLanding();
    const field = screen.getByLabelText('Room code or invite link');
    await user.type(field, 'not a room!');
    await user.click(screen.getByRole('button', { name: 'Join room' }));

    expect(navigate).not.toHaveBeenCalled();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Paste an invite link or a room code');
  });

  test('requires a name', async () => {
    const { navigate, user } = renderLanding();
    await user.clear(screen.getByLabelText('Your name'));
    await user.click(screen.getByRole('button', { name: 'Create a room' }));
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name');
  });
});
