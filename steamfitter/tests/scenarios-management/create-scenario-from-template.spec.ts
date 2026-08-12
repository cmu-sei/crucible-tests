// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import {
  seedScenarioTemplate,
  deleteScenarioTemplatesByPrefix,
  deleteScenariosByPrefix,
} from '../../fixtures';
import {
  navigateToHomeSection,
  findHomeRowByText,
  openRowContextMenu,
  clickContextMenuItem,
  respondToConfirmDialog,
} from '../../test-helpers';

test.describe('Scenarios Management', () => {
  // The scenario created from the template inherits the template's name, so a
  // single prefix cleans up both.
  const TEMPLATE_NAME = `E2E Create Scenario Template ${Date.now()}`;

  test.beforeEach(async () => {
    await seedScenarioTemplate(TEMPLATE_NAME, 'Template used to create a scenario', 2);
  });

  // Delete the scenario first (it references the template), then the template.
  test.afterEach(async () => {
    await deleteScenariosByPrefix(['E2E Create Scenario Template']);
    await deleteScenarioTemplatesByPrefix(['E2E Create Scenario Template']);
  });

  test('Create a scenario from a template', async ({ steamfitterAuthenticatedPage: page }) => {
    // 1. Open the Scenario Templates section and locate the seeded template.
    await navigateToHomeSection(page, 'Scenario Templates');
    const templateRow = await findHomeRowByText(page, TEMPLATE_NAME);
    await expect(templateRow).toBeVisible({ timeout: 10000 });

    // 2. Open the row menu and choose "Create a Scenario", then confirm. Wait on the
    // scenarios POST so the new scenario exists before we switch sections.
    await openRowContextMenu(page, templateRow, 'Scenario Template Menu');
    await clickContextMenuItem(page, 'Create a Scenario');

    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/scenarios') &&
        response.request().method() === 'POST' &&
        response.ok(),
      { timeout: 15000 }
    );
    await respondToConfirmDialog(page, true);
    await createResponse.catch(() => {});

    // 3. Switch to the Scenarios section.
    await navigateToHomeSection(page, 'Scenarios');

    // expect: A scenario named after the template appears in the list.
    const scenarioRow = await findHomeRowByText(page, TEMPLATE_NAME);
    await expect(scenarioRow).toBeVisible({ timeout: 10000 });
  });
});
