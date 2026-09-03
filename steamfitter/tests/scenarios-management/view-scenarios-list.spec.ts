// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { seedScenario, deleteScenariosByPrefix } from '../../fixtures';
import { navigateToHomeSection, findHomeRowByText } from '../../test-helpers';

test.describe('Scenarios Management', () => {
  const SCENARIO_NAME = `E2E View Scenario ${Date.now()}`;
  const SCENARIO_DESCRIPTION = 'Seeded so the scenarios list has a known row.';

  test.beforeEach(async () => {
    await seedScenario(SCENARIO_NAME, SCENARIO_DESCRIPTION);
  });

  test.afterEach(async () => {
    await deleteScenariosByPrefix(['E2E View Scenario']);
  });

  test('View scenarios list', async ({ steamfitterAuthenticatedPage: page }) => {
    // 1. Open the Scenarios section on the home page.
    await navigateToHomeSection(page, 'Scenarios');

    // expect: The list renders its column headers (Name / View / Status).
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    await expect(page.locator('button[title="Add Scenario"]')).toBeVisible();

    // expect: The seeded scenario is findable via the Search filter.
    const row = await findHomeRowByText(page, SCENARIO_NAME);
    await expect(row).toBeVisible({ timeout: 10000 });
  });
});
