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
  const TEMPLATE_NAME = `E2E Cancel Delete Template ${Date.now()}`;

  test.beforeEach(async () => {
    await seedScenarioTemplate(TEMPLATE_NAME, 'Template whose deletion is cancelled', 1);
  });

  test.afterEach(async () => {
    await deleteScenarioTemplatesByPrefix(['E2E Cancel Delete Template']);
  });

  test('Cancel scenario template deletion', async ({ steamfitterAuthenticatedPage: page }) => {
    // 1. Open the Scenario Templates section and locate the seeded row.
    await navigateToHomeSection(page, 'Scenario Templates');
    const row = await findHomeRowByText(page, TEMPLATE_NAME);
    await expect(row).toBeVisible({ timeout: 10000 });

    // 2. Open the row menu, choose Delete, then dismiss the confirmation.
    await openRowContextMenu(page, row, 'Scenario Template Menu');
    await clickContextMenuItem(page, 'Delete');
    await respondToConfirmDialog(page, false);

    // expect: The template is still present — cancelling the confirm dialog must not
    // delete it.
    const stillThere = await findHomeRowByText(page, TEMPLATE_NAME);
    await expect(stillThere).toBeVisible({ timeout: 5000 });
  });
});
