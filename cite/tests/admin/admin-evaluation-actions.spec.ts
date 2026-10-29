// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, seedCompleteEvaluation, cleanupCompleteEvaluation, CITE_THEMES, setCiteTheme } from '../../fixtures';
import { navigateToAdminSection, waitForAdminListLoad, recordWebSocketMessages } from '../../test-helpers';

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Administration - Evaluations`, () => {

    let evalName = '';
    let seedData: { scoringModelId: string; evaluationId: string; teamTypeId: string; teamId: string } | null = null;
    let otherSeedData: { scoringModelId: string; evaluationId: string; teamTypeId: string; teamId: string } | null = null;

    test('Manage Evaluation Actions', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      // 1. Seed a complete evaluation via API (includes team, team type, etc.)
      evalName = `Actions Test ${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const fullSeedData = await seedCompleteEvaluation(evalName, 0);
      seedData = fullSeedData;

      // 2. Navigate to evaluations and open the evaluation detail
      await navigateToAdminSection(page, 'Evaluations');
      await waitForAdminListLoad(page, '/api/evaluations', true);

      // Search for the seeded evaluation
      const searchBox = page.locator('input[placeholder="Search"], input[type="search"], input[aria-label="Search"]').first();
      await expect(searchBox).toBeVisible({ timeout: 5000 });
      await searchBox.clear();
      await searchBox.fill(evalName);
      await page.waitForTimeout(1000);

      const evalRow = page.locator('tbody tr').filter({ hasText: evalName }).first();
      await expect(evalRow).toBeVisible({ timeout: 10000 });
      await evalRow.click();
      await page.waitForTimeout(1000);

      // 3. Expand the Actions panel (team already created via API seed)
      const actionsPanelButton = page.getByRole('button', { name: 'Actions', exact: true });
      await expect(actionsPanelButton).toBeVisible({ timeout: 10000 });
      await actionsPanelButton.click();
      await page.waitForTimeout(1000);

      // 4. Add an action
      const addActionButton = page.locator('button[title="Add Action"]');
      await expect(addActionButton).toBeVisible({ timeout: 5000 });
      await addActionButton.click();

      const actionDialog = page.getByRole('dialog');
      await expect(actionDialog).toBeVisible({ timeout: 5000 });

      await actionDialog.getByRole('textbox', { name: 'Action Description' }).fill('Test Action Description');

      const actionSaveButton = actionDialog.getByRole('button', { name: 'Save' });
      await expect(actionSaveButton).toBeEnabled({ timeout: 5000 });
      await actionSaveButton.click();
      await expect(actionDialog).not.toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(1000);

      // 5. Verify the action appears in the actions table within the Actions region
      const actionsRegion = page.getByRole('region', { name: 'Actions' });
      const actionItem = actionsRegion.getByRole('cell', { name: 'Test Action Description', exact: true }).first();
      await expect(actionItem).toBeVisible({ timeout: 10000 });

      // 6. Edit the action: the API cannot move an existing action to another team, so
      //    Team is locked, and the save sends only the editable fields
      const actionRow = actionsRegion.getByRole('row').filter({ hasText: 'Test Action Description' });
      await actionRow.locator('button[title="Edit Action"]').click();
      const editDialog = page.getByRole('dialog');
      await expect(editDialog).toBeVisible({ timeout: 5000 });
      await expect(editDialog.getByRole('combobox', { name: 'Team' })).toHaveAttribute('aria-disabled', 'true');

      const editDescription = editDialog.getByRole('textbox', { name: 'Action Description' });
      await editDescription.fill('Edited Action Description');
      const updateResponse = page.waitForResponse(
        (r) => r.url().includes('/api/actions/') && r.request().method() === 'PUT',
      );
      await editDialog.getByRole('button', { name: 'Save' }).click();
      expect((await updateResponse).status()).toBe(200);
      await expect(editDialog).not.toBeVisible({ timeout: 10000 });

      // 7. Verify the edited action keeps its place in the actions table
      await expect(actionsRegion.getByRole('cell', { name: 'Edited Action Description', exact: true }).first()).toBeVisible({ timeout: 10000 });
    });

    /**
     * The admin page is sent every evaluation's new teams live. An action added for all teams
     * must still be created for this evaluation's teams only; one created for the other
     * evaluation's team is refused with 409 "The team is not part of the evaluation".
     */
    test('Add an Action for All Teams While Another Evaluation Gains a Team', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);
      // Before the admin page opens its hub connection
      const hubMessages = recordWebSocketMessages(page);

      // 1. Seed an evaluation with one team and open its Actions panel
      evalName = `Actions Test ${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      seedData = await seedCompleteEvaluation(evalName, 0);

      await navigateToAdminSection(page, 'Evaluations');
      await waitForAdminListLoad(page, '/api/evaluations', true);
      const searchBox = page.locator('input[placeholder="Search"], input[type="search"], input[aria-label="Search"]').first();
      await expect(searchBox).toBeVisible({ timeout: 5000 });
      await searchBox.fill(evalName);
      const evalRow = page.locator('tbody tr').filter({ hasText: evalName }).first();
      await expect(evalRow).toBeVisible({ timeout: 10000 });
      await evalRow.click();
      const actionsPanelButton = page.getByRole('button', { name: 'Actions', exact: true });
      await expect(actionsPanelButton).toBeVisible({ timeout: 10000 });
      await actionsPanelButton.click();
      const addActionButton = page.locator('button[title="Add Action"]');
      await expect(addActionButton).toBeVisible({ timeout: 5000 });

      // 2. Another evaluation gains a team while the panel is open
      const otherName = `E2E Actions Other ${theme} ${Date.now()}`;
      otherSeedData = await seedCompleteEvaluation(otherName, 0);
      // expect: The admin page is sent the other evaluation's team
      await expect
        .poll(() => hubMessages.some((m) => m.includes('"TeamCreated"') && m.includes(`Team for ${otherName}`)), { timeout: 15000 })
        .toBe(true);

      // 3. Add an action without choosing a team, so it is added for every team
      const creates: Array<{ status: number | null }> = [];
      page.on('request', (request) => {
        if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/api/actions')) {
          const create: { status: number | null } = { status: null };
          creates.push(create);
          request.response().then((response) => { create.status = response?.status() ?? 0; });
        }
      });
      await addActionButton.click();
      const actionDialog = page.getByRole('dialog');
      await expect(actionDialog).toBeVisible({ timeout: 5000 });
      await actionDialog.getByRole('textbox', { name: 'Action Description' }).fill('All Teams Action');
      await actionDialog.getByRole('button', { name: 'Save' }).click();
      await expect(actionDialog).not.toBeVisible({ timeout: 10000 });

      // 4. Verify the action is listed and was created for this evaluation's one team only
      const actionsRegion = page.getByRole('region', { name: 'Actions' });
      await expect(actionsRegion.getByRole('cell', { name: 'All Teams Action', exact: true }).first()).toBeVisible({ timeout: 10000 });
      // The creates are sent together, so every one has been sent once the first is listed
      await expect.poll(() => creates.every((c) => c.status !== null), { timeout: 10000 }).toBe(true);
      // expect: One create, accepted; none for the other evaluation's team
      expect(creates.map((c) => c.status)).toEqual([201]);
    });

    test.afterEach(async () => {
      if (seedData) {
        await cleanupCompleteEvaluation(seedData);
        seedData = null;
      }
      if (otherSeedData) {
        await cleanupCompleteEvaluation(otherSeedData);
        otherSeedData = null;
      }
    });
  });
}
