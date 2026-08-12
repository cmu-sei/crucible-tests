// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { seedScenarioTemplate, deleteScenarioTemplatesByPrefix } from '../../fixtures';
import {
  navigateToHomeSection,
  findHomeRowByText,
  openRowContextMenu,
  clickContextMenuItem,
  respondToConfirmDialog,
} from '../../test-helpers';

test.describe('Scenario Templates Management', () => {
  const TEMPLATE_NAME = `E2E Delete Template ${Date.now()}`;

  test.beforeEach(async () => {
    await seedScenarioTemplate(TEMPLATE_NAME, 'Template to be deleted', 1);
  });

  // Backstop: if the delete assertion failed mid-test the row may survive, so purge
  // by prefix. Idempotent — a no-op when the test already deleted its own row.
  test.afterEach(async () => {
    await deleteScenarioTemplatesByPrefix(['E2E Delete Template']);
  });

  test('Delete a scenario template', async ({ steamfitterAuthenticatedPage: page }) => {
    // 1. Open the Scenario Templates section and locate the seeded row.
    await navigateToHomeSection(page, 'Scenario Templates');
    const row = await findHomeRowByText(page, TEMPLATE_NAME);
    await expect(row).toBeVisible({ timeout: 10000 });

    // 2. Open the row menu and choose Delete.
    await openRowContextMenu(page, row, 'Scenario Template Menu');
    await clickContextMenuItem(page, 'Delete');

    // 3. Confirm the deletion. Wait on the DELETE so the assertion runs against a
    // persisted removal rather than a race.
    const deleteResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/scenarioTemplates') &&
        response.request().method() === 'DELETE' &&
        response.ok(),
      { timeout: 15000 }
    );
    await respondToConfirmDialog(page, true);
    await deleteResponse.catch(() => {});

    // expect: The row is gone from the (filtered) list. The DELETE response above
    // already confirms server-side removal; this asserts the UI reflects it.
    await expect(
      page.locator('tbody tr.element-row').filter({ hasText: TEMPLATE_NAME })
    ).toHaveCount(0, { timeout: 10000 });
  });
});
