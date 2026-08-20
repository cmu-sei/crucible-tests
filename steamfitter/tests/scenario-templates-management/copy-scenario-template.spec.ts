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
  const TEMPLATE_NAME = `E2E Copy Template ${Date.now()}`;

  test.beforeEach(async () => {
    await seedScenarioTemplate(TEMPLATE_NAME, 'Template to be copied', 1);
  });

  // The API names the copy "<original> - <user name>", so both the original and the
  // copy share the E2E Copy Template prefix and are removed by this one call.
  test.afterEach(async () => {
    await deleteScenarioTemplatesByPrefix(['E2E Copy Template']);
  });

  test('Copy a scenario template', async ({ steamfitterAuthenticatedPage: page }) => {
    // 1. Open the Scenario Templates section and locate the seeded row.
    await navigateToHomeSection(page, 'Scenario Templates');
    const row = await findHomeRowByText(page, TEMPLATE_NAME);
    await expect(row).toBeVisible({ timeout: 10000 });

    // 2. Open the row menu, choose Copy, and confirm. The copy is created via a POST
    // to the copy endpoint; wait on it so the new row exists before we look for it.
    await openRowContextMenu(page, row, 'Scenario Template Menu');
    await clickContextMenuItem(page, 'Copy');

    const copyResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/scenarioTemplates') &&
        response.request().method() === 'POST' &&
        response.ok(),
      { timeout: 15000 }
    );
    await respondToConfirmDialog(page, true);
    await copyResponse.catch(() => {});

    // expect: A new template whose name begins with the original's name appears
    // (the API appends " - <user name>"). Filter by the original name so both the
    // source row and the copy collapse onto page 1, then assert 2 matching rows.
    await findHomeRowByText(page, TEMPLATE_NAME);
    await expect(
      page.locator('tbody tr.element-row').filter({ hasText: TEMPLATE_NAME })
    ).toHaveCount(2, { timeout: 10000 });
  });
});
