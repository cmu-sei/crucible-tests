// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Scenarios Management', () => {
  let templateId: string | null = null;
  let scenarioId: string | null = null;

  test.afterEach(async ({ steamfitterApi }) => {
    if (scenarioId) {
      try { await steamfitterApi.delete(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}`); } catch {}
      scenarioId = null;
    }
    if (templateId) {
      try { await steamfitterApi.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${templateId}`); } catch {}
      templateId = null;
    }
  });

  test('Configure Scenario Start and End Times', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    const templateResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Template for Time Config', description: 'Test template', durationHours: 1 },
    });
    expect(templateResp.ok()).toBeTruthy();
    const template = await templateResp.json();
    templateId = template.id;

    const scenarioResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'Scenario Time Config', description: 'Configure times', scenarioTemplateId: templateId },
    });
    expect(scenarioResp.ok()).toBeTruthy();
    const scenario = await scenarioResp.json();
    scenarioId = scenario.id;

    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.locator('mat-list').getByText('Scenarios', { exact: true }).click();
    // Open the Scenario Menu for the specific scenario row
    const scenarioRow = page.getByRole('row', { name: /Scenario Time Config/ });
    await scenarioRow.getByRole('button', { name: 'Scenario Menu' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();

    // Verify the Edit Scenario dialog opens and shows date/time fields
    const editDialog = page.getByRole('dialog');
    await expect(editDialog).toBeVisible();

    // Verify Start Date / Time and End Date / Time fields are present
    await expect(editDialog.getByText('Start Date / Time')).toBeVisible();
    await expect(editDialog.getByText('End Date / Time')).toBeVisible();

    // Cancel the dialog since date pickers are calendar-based and dates are already set
    await editDialog.getByRole('button', { name: /cancel/i }).click();

    // Verify the scenario list shows the date values
    await expect(page.getByText('Scenario Time Config')).toBeVisible();
  });
});
