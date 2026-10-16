import { expect } from '@playwright/test';

// Opens the home page as `name`, creates a room and waits until the shared editor is ready.
export async function createRoom(page, name) {
  await page.goto('/');
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'Create a room' }).click();
  await expect(page).toHaveURL(/\/r\/[a-z]+-[a-z]+-\d{4}$/);
  await waitForEditor(page);
  return new URL(page.url()).pathname;
}

// Opens an invite link and answers the name prompt.
export async function joinRoom(page, path, name) {
  await page.goto(path);
  const card = page.getByRole('region', { name: 'Join this room' });
  await card.getByLabel('Your name').fill(name);
  await card.getByRole('button', { name: 'Join room' }).click();
  await waitForEditor(page);
}

// The editor chunk is large (Monaco); with several browsers starting at once it can take a
// while to download and parse, so allow more than the default 10 s for it to appear.
export async function waitForEditor(page) {
  await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Loading the shared code…')).toBeHidden();
  await skipTour(page);
}

export async function skipTour(page) {
  const skip = page.getByRole('button', { name: 'Skip tour' });
  if (await skip.isVisible()) await skip.click();
}

// Types into Monaco. Monaco closes brackets and quotes as you type, so typing the closing
// character just steps over the one it added.
export async function typeInEditor(page, text) {
  await page.locator('.monaco-editor .view-lines').click();
  await page.keyboard.type(text);
}

export const editorText = (page) => page.locator('.monaco-editor .view-lines');
