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

  test('Create Scenario from Template', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    const createResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Template for Scenario Creation', description: 'Test template', durationHours: 2 },
    });
    expect(createResp.ok()).toBeTruthy();
    const template = await createResp.json();
    templateId = template.id;

    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.locator('mat-list').getByText('Scenario Templates', { exact: true }).click();

    const templateRow = page.getByRole('row', { name: /Template for Scenario Creation/ });
    await templateRow.getByRole('button', { name: 'Scenario Template Menu' }).click();
    await page.getByRole('menuitem', { name: /create a scenario/i }).click();

    // Confirm scenario creation in the dialog
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Yes' }).click();

    // Navigate to Scenarios view to verify scenario was created
    await page.locator('mat-list').getByText('Scenarios', { exact: true }).click();
    await expect(page.locator('table').locator('td').first()).toBeVisible();

    // Capture scenario ID for cleanup
    const scenariosResp = await steamfitterApi.get(`${Services.Steamfitter.API}/api/scenarios`);
    const scenarios = await scenariosResp.json();
    const created = scenarios.find((s: any) => s.scenarioTemplateId === templateId);
    if (created) {
      scenarioId = created.id;
    }
  });
});
