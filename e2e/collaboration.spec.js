import { expect, test } from '@playwright/test';
import { createRoom, editorText, joinRoom, typeInEditor } from './helpers.js';

test('two people create, join, edit, chat and share tasks in one room', async ({ browser }) => {
  const adaContext = await browser.newContext();
  const graceContext = await browser.newContext();
  const ada = await adaContext.newPage();
  const grace = await graceContext.newPage();

  const roomPath = await createRoom(ada, 'Ada');
  await joinRoom(grace, roomPath, 'Grace');

  // Both see each other in the sidebar.
  const adaPeople = ada.getByRole('list', { name: /people in this room/ });
  await expect(adaPeople).toContainText('Ada (you)');
  await expect(adaPeople).toContainText('Grace');
  const gracePeople = grace.getByRole('list', { name: /people in this room/ });
  await expect(gracePeople).toContainText('Grace (you)');
  await expect(gracePeople).toContainText('Ada');

  // Edits travel both ways.
  await typeInEditor(ada, 'const answer = 42;');
  await expect(editorText(grace)).toContainText('const answer = 42;');
  await editorText(grace).click();
  await grace.keyboard.press('Control+End');
  await grace.keyboard.type(' // checked by Grace');
  await expect(editorText(ada)).toContainText('// checked by Grace');

  // Chat.
  await ada.getByRole('tab', { name: /^Chat/ }).click();
  await ada.getByLabel('Message the room').fill('Shall we add tests?');
  await ada.getByLabel('Message the room').press('Enter');
  await grace.getByRole('tab', { name: /^Chat/ }).click();
  await expect(grace.getByRole('log', { name: 'Chat messages' })).toContainText('Shall we add tests?');

  // Tasks.
  await grace.getByRole('tab', { name: /^Tasks/ }).click();
  await grace.getByLabel('New task').fill('Write the parser tests');
  await grace.getByLabel('New task').press('Enter');
  await ada.getByRole('tab', { name: /^Tasks/ }).click();
  await expect(ada.getByRole('checkbox', { name: 'Write the parser tests' })).toBeVisible();

  await adaContext.close();
  await graceContext.close();
});

test('runs JavaScript and shows the output', async ({ page }) => {
  await createRoom(page, 'Ada');
  await typeInEditor(page, 'console.log("six times seven is", 6 * 7)');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  // The runner allows its sandbox worker up to 15 s to start on a busy machine.
  await expect(page.getByRole('region', { name: 'Code output' })).toContainText('six times seven is 42', {
    timeout: 20_000,
  });
});

test('the code is still there after reloading', async ({ page, browser }) => {
  const roomPath = await createRoom(page, 'Ada');
  await typeInEditor(page, 'let kept = true;');

  // A second visitor seeing the edit proves the server has it, without guessing at timing.
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await joinRoom(other, roomPath, 'Grace');
  await expect(editorText(other)).toContainText('let kept = true;');
  await otherContext.close();

  await page.reload();

  // The display name usually survives the reload in history state; if not, answer the prompt.
  const prompt = page.getByRole('region', { name: 'Join this room' });
  await expect(prompt.or(page.locator('.monaco-editor'))).toBeVisible();
  if (await prompt.isVisible()) await prompt.getByRole('button', { name: 'Join room' }).click();
  await expect(editorText(page)).toContainText('let kept = true;');
});

test('invalid links and unknown pages show a way back home', async ({ page }) => {
  await page.goto('/r/not%20a%20room');
  await expect(page.getByRole('heading', { name: 'That link does not look right' })).toBeVisible();
  await page.goto('/nowhere');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.getByRole('button', { name: 'Go to the home page' }).click();
  await expect(page.getByRole('button', { name: 'Create a room' })).toBeVisible();
});
