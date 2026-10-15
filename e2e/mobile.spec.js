import { expect, test } from '@playwright/test';
import { createRoom, editorText, typeInEditor } from './helpers.js';

test('on a phone, views switch from the bottom tab bar', async ({ page }) => {
  await createRoom(page, 'Ada');
  const views = page.getByRole('tablist', { name: 'Room views' });
  await expect(views).toBeVisible();
  await expect(page.getByRole('group', { name: 'Code symbols' })).toBeVisible();

  // The symbol bar types characters phone keyboards hide.
  await typeInEditor(page, 'console.log');
  await page.getByRole('button', { name: 'Type (' }).click();
  await page.keyboard.type('"from a phone"');
  await expect(editorText(page)).toContainText('console.log("from a phone")');

  // Run switches to the Output view.
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(views.getByRole('tab', { name: 'Output' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('region', { name: 'Code output' })).toContainText('from a phone', { timeout: 20_000 });

  await views.getByRole('tab', { name: /^Chat/ }).click();
  await page.getByLabel('Message the room').fill('Hello from my phone');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('log', { name: 'Chat messages' })).toContainText('Hello from my phone');
});

test('on a phone, every control is at least 44px', async ({ page }) => {
  await createRoom(page, 'Ada');
  const tooSmall = await page.evaluate(() =>
    [...document.querySelectorAll('button, a[href], input, select, textarea, [role=tab]')]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return (
          box.width > 0 && !element.closest('[hidden], .monaco-editor') && !element.classList.contains('skip-link')
        );
      })
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width < 43.5 || box.height < 43.5;
      })
      .map((element) => element.getAttribute('aria-label') || element.textContent.trim()),
  );
  expect(tooSmall).toEqual([]);
});
