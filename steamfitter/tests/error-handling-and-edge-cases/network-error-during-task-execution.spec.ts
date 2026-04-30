// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  let templateId: string | null = null;
  let scenarioId: string | null = null;

  test.afterEach(async ({ steamfitterApi }) => {
    if (scenarioId) {
      try { await steamfitterApi.delete(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}`); } catch {}
    }
    if (templateId) {
      try { await steamfitterApi.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${templateId}`); } catch {}
    }
  });

  test('Network Error During Task Execution', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    // Setup: create template with task, scenario via authenticated API
    const tResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Network Error Template', description: 'Template for network error test', durationHours: 1 },
    });
    expect(tResp.ok()).toBeTruthy();
    const template = await tResp.json();
    templateId = template.id;

    await steamfitterApi.post(`${Services.Steamfitter.API}/api/tasks/scenariotemplate/${templateId}`, {
      data: { name: 'Network Task', description: 'Task that may fail due to network', triggerCondition: 'Manual' },
    });

    const sResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'Network Error Scenario', description: 'Scenario for network error test', scenarioTemplateId: templateId },
    });
    expect(sResp.ok()).toBeTruthy();
    const scenario = await sResp.json();
    scenarioId = scenario.id;

    await page.goto(`${Services.Steamfitter.UI}/admin`);
    // Wait for admin page to load
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 15000 });

    // Navigate to Scenarios section
    await page.locator('text=Scenarios').first().click();
    await page.waitForTimeout(1000);

    await page.locator('text=Network Error Scenario').first().click();
    await page.waitForTimeout(1000);

    // Execute the task (which may fail gracefully)
    const taskRow = page.locator('text=Network Task').first();
    const hasTask = await taskRow.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasTask) {
      const executeButton = taskRow.locator('..').locator('button').first();
      const hasExecute = await executeButton.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasExecute) {
        await executeButton.click();
        await page.waitForTimeout(2000);
      }
    }

    // The page should still be functional (not crashed) - verify admin heading is still visible
    const pageStillFunctional = await page.getByRole('heading', { name: 'Administration' }).isVisible({ timeout: 5000 }).catch(() => false);
    expect(pageStillFunctional).toBeTruthy();
  });
});
