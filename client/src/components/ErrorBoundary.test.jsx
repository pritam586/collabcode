import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary.jsx';

function Crash() {
  throw new Error('kaboom');
}

test('a crash shows the error page with ways out instead of a blank screen', () => {
  // React logs caught render errors; keep the test output quiet.
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  render(
    <ErrorBoundary>
      <Crash />
    </ErrorBoundary>,
  );
  expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Go to the home page' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Copy error details' })).toBeInTheDocument();
  consoleError.mockRestore();
});
