// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import {
  seedScenario,
  deleteScenariosByPrefix,
  isPlayerApiAvailable,
  createPlayerView,
  deletePlayerView,
} from '../../fixtures';
import {
  navigateToHomeSection,
  findHomeRowByText,
  openRowContextMenu,
  clickContextMenuItem,
} from '../../test-helpers';

/**
 * Editing a scenario's details through the UI dialog requires the scenario to have a
 * Player *view* bound: the dialog's Save button is gated on `viewId` (plus start/end
 * dates), so a view-less scenario cannot be saved from the UI at all.
 *
 * The Player API is a separate service that may not be running. We therefore probe it
 * once and branch:
 *  - Player up   → seed a real view, bind it to the scenario, and exercise the full
 *                  edit-and-save round-trip through the dialog.
 *  - Player down → assert the dependency-free behavior instead: a view-less scenario
 *                  shows "Select a view!" and its edit dialog keeps Save disabled.
 * The seeded view is created once for this file and removed in afterAll.
 */
test.describe('Scenarios Management', () => {
  const ORIGINAL_NAME = `E2E Edit Scenario ${Date.now()}`;
  const UPDATED_NAME = `E2E Edit Scenario Updated ${Date.now()}`;

  let playerAvailable = false;
  let viewId: string | null = null;

  test.beforeAll(async () => {
    playerAvailable = await isPlayerApiAvailable();
    if (playerAvailable) {
      viewId = await createPlayerView(`E2E Edit Scenario View ${Date.now()}`);
    } else {
      console.log('[edit-scenario] Player API unavailable — running dependency-free assertions only.');
    }
  });

  test.afterAll(async () => {
    if (viewId) {
      await deletePlayerView(viewId);
      viewId = null;
    }
  });

  test.afterEach(async () => {
    await deleteScenariosByPrefix(['E2E Edit Scenario']);
  });

  test('Edit scenario details', async ({ steamfitterAuthenticatedPage: page }) => {
    // Seed a scenario, binding the view when Player is available so the UI Save path
    // is reachable.
    await seedScenario(ORIGINAL_NAME, 'Scenario to be edited', {
      viewId: viewId ?? undefined,
    });

    // 1. Open the Scenarios section and locate the seeded row.
    await navigateToHomeSection(page, 'Scenarios');
    const row = await findHomeRowByText(page, ORIGINAL_NAME);
    await expect(row).toBeVisible({ timeout: 10000 });

    // 2. Open the row menu and choose Edit.
    await openRowContextMenu(page, row, 'Scenario Menu');
    await clickContextMenuItem(page, 'Edit');

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Edit Scenario' })).toBeVisible({ timeout: 5000 });

    const nameField = dialog.getByRole('textbox', { name: /Name/ });
    const saveButton = dialog.getByRole('button', { name: 'Save' });

    if (!playerAvailable) {
      // Dependency-free path: without a view, Save is disabled (errorFree() requires a
      // viewId) and the list flags the scenario as needing a view. Assert both, then
      // close via Cancel.
      await expect(saveButton).toBeDisabled();
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).not.toBeVisible({ timeout: 10000 });

      const readyRow = await findHomeRowByText(page, ORIGINAL_NAME);
      await expect(readyRow).toContainText('Select a view!');
      return;
    }

    // 3. Player-backed path: change the name and Save. handleEditComplete PUTs the
    // scenario; wait on that response.
    await nameField.fill(UPDATED_NAME);
    await expect(nameField).toHaveValue(UPDATED_NAME);

    const saveResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/scenarios') &&
        response.request().method() === 'PUT' &&
        response.ok(),
      { timeout: 15000 }
    );
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();
    await saveResponse.catch(() => {});
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // Re-navigate so the list is re-fetched, then search to isolate the row.
    await navigateToHomeSection(page, 'Scenarios');
    const updatedRow = await findHomeRowByText(page, UPDATED_NAME);
    await expect(updatedRow).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('tbody tr.element-row').filter({ hasText: ORIGINAL_NAME })
    ).toHaveCount(0);
  });
});
