// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import {
  createWorkspace,
  deleteGamespace,
  deleteWorkspace,
  getTopoMojoAdminToken,
  setWorkspaceChallenge,
} from '../../../topomojo-helpers';

test.describe('Gamespace Operations', () => {
  let workspaceId: string | undefined;
  let gamespaceId: string | undefined;
  const question = `What port does the web server use? ${Date.now()}`;

  test.beforeEach(async () => {
    // No VM templates, so starting the gamespace boots nothing.
    const token = await getTopoMojoAdminToken();
    workspaceId = (await createWorkspace(token, {
      name: `E2E Gamespace Challenge ${Date.now()}`,
      audience: 'everyone',
    })).id;
    await setWorkspaceChallenge(token, workspaceId, {
      text: 'Answer the **questions** below.',
      variants: [{
        text: 'Variant 1',
        sections: [{ name: 'Main', text: '', questions: [{ text: question, answer: '80', penalty: 0 }] }],
      }],
    });
  });

  test.afterEach(async () => {
    const token = await getTopoMojoAdminToken();
    if (gamespaceId) await deleteGamespace(token, gamespaceId);
    if (workspaceId) await deleteWorkspace(token, workspaceId);
    gamespaceId = undefined;
    workspaceId = undefined;
  });

  test('Gamespace Challenge View', async ({ topomojoAuthenticatedPage: page }) => {
    // 1. Navigate to the gamespace and start it
    await page.goto(`${Services.TopoMojo.UI}/mojo/${workspaceId}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    const registered = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/gamespace$/.test(new URL(r.url()).pathname),
    );
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    const response = await registered;
    expect(response.ok()).toBe(true);
    gamespaceId = (await response.json()).id;

    // expect: Challenge section is accessible, with its markdown text rendered
    const quiz = page.locator('app-gamespace-quiz');
    await expect(quiz.locator('markdown strong')).toHaveText('questions');

    // 2. View challenge questions
    // expect: Challenge questions are displayed
    // expect: Answer input fields are available
    const questionGroup = quiz.locator('.form-group').filter({ hasText: question });
    await expect(questionGroup).toBeVisible();
    await expect(questionGroup.getByRole('textbox')).toBeEditable();

    // expect: The session countdown runs: it changes without any interaction, which
    // also shows the view refreshes from its timer.
    const clock = page.locator('.clock').first();
    await expect(clock).toHaveText(/\d{2}:\d{2}:\d{2}/);
    const startedAt = await clock.innerText();
    await expect(clock).not.toHaveText(startedAt);

    // 3. End the gamespace
    // expect: The page shows Game Over
    await page.getByRole('button', { name: 'End', exact: true }).first().click();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.getByText('Game Over').first()).toBeVisible();
  });
});
