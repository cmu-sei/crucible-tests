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
  respondToConfirmDialog,
  setScenarioStatusFilter,
} from '../../test-helpers';

/**
 * The scenario start/end lifecycle requires a Player view: Start is only offered when
 * the scenario is `ready` AND has a `viewId`. The Player API is optional, so this
 * whole spec is skipped when it isn't reachable (there is no meaningful view-less
 * fallback for "start the scenario"). The seeded view is removed in afterAll.
 */
test.describe('Scenarios Management', () => {
  const SCENARIO_NAME = `E2E Lifecycle Scenario ${Date.now()}`;

  let playerAvailable = false;
  let viewId: string | null = null;

  test.beforeAll(async () => {
    playerAvailable = await isPlayerApiAvailable();
    if (playerAvailable) {
      viewId = await createPlayerView(`E2E Lifecycle View ${Date.now()}`);
    }
  });

  test.afterAll(async () => {
    if (viewId) {
      await deletePlayerView(viewId);
      viewId = null;
    }
  });

  test.afterEach(async () => {
    await deleteScenariosByPrefix(['E2E Lifecycle Scenario']);
  });

  test('Start then end a scenario', async ({ steamfitterAuthenticatedPage: page }) => {
    test.skip(!playerAvailable, 'Player API unavailable — scenario start/end requires a view.');

    // Seed a ready, view-bound scenario so Start is available.
    await seedScenario(SCENARIO_NAME, 'Scenario exercised through start/end', {
      viewId: viewId ?? undefined,
    });

    // 1. Open the Scenarios section and locate the row.
    await navigateToHomeSection(page, 'Scenarios');
    let row = await findHomeRowByText(page, SCENARIO_NAME);
    await expect(row).toBeVisible({ timeout: 10000 });

    // 2. Start the scenario via the row menu, confirming the prompt. Wait on the
    // start PUT so the status transition is persisted before we assert.
    await openRowContextMenu(page, row, 'Scenario Menu');
    await clickContextMenuItem(page, 'Start');
    const startResponse = page.waitForResponse(
      (response) =>
        /\/api\/scenarios\/[^/]+\/start/.test(response.url()) &&
        response.request().method() === 'PUT' &&
        response.ok(),
      { timeout: 15000 }
    );
    await respondToConfirmDialog(page, true);
    await startResponse.catch(() => {});

    // expect: The row reflects the active status.
    row = await findHomeRowByText(page, SCENARIO_NAME);
    await expect(row).toContainText('active', { timeout: 10000 });

    // 3. End the scenario via the row menu.
    await openRowContextMenu(page, row, 'Scenario Menu');
    await clickContextMenuItem(page, 'End');
    const endResponse = page.waitForResponse(
      (response) =>
        /\/api\/scenarios\/[^/]+\/end/.test(response.url()) &&
        response.request().method() === 'PUT' &&
        response.ok(),
      { timeout: 15000 }
    );
    await respondToConfirmDialog(page, true);
    await endResponse.catch(() => {});

    // expect: The scenario is now ended. The Scenarios list defaults to a Status
    // filter of "Active, Ready", which hides ended scenarios — so add "Ended" to the
    // filter, then search to isolate the row and assert it reports the ended status
    // with a populated End time (yyyy-MM-dd HH:mm).
    await setScenarioStatusFilter(page, ['Active', 'Ready', 'Ended']);
    row = await findHomeRowByText(page, SCENARIO_NAME);
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row).toContainText('ended', { timeout: 10000 });
    await expect(row).toContainText(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
  });
});
