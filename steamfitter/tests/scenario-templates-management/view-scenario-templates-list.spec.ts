// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { seedScenarioTemplate, deleteScenarioTemplatesByPrefix } from '../../fixtures';
import { navigateToHomeSection, findHomeRowByText } from '../../test-helpers';

test.describe('Scenario Templates Management', () => {
  // Unique per run so parallel/retried runs never collide, and the name-prefix
  // cleanup below only ever removes rows this suite created.
  const TEMPLATE_NAME = `E2E View List Template ${Date.now()}`;
  const TEMPLATE_DESCRIPTION = 'Seeded so the list has a known row to assert on.';

  // Seed via the API so the list is guaranteed to have our row regardless of what
  // else exists in the environment.
  test.beforeEach(async () => {
    await seedScenarioTemplate(TEMPLATE_NAME, TEMPLATE_DESCRIPTION, 1);
  });

  test.afterEach(async () => {
    await deleteScenarioTemplatesByPrefix(['E2E View List Template']);
  });

  test('View scenario templates list', async ({ steamfitterAuthenticatedPage: page }) => {
    // 1. Open the Scenario Templates section on the home page.
    await navigateToHomeSection(page, 'Scenario Templates');

    // expect: The list renders its column headers and the Add button (the section's
    // primary affordance) is present.
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('columnheader', { name: 'Description' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Duration (Hours)' })).toBeVisible();
    await expect(page.locator('button[title="Add Scenario Template"]')).toBeVisible();

    // expect: The seeded template is findable via the Search filter and shows its
    // name and description.
    const row = await findHomeRowByText(page, TEMPLATE_NAME);
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row).toContainText(TEMPLATE_DESCRIPTION);
  });
});
