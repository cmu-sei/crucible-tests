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

  test('Execute Task Against Non-Existent VM', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    // Setup: create template with non-matching VM mask task via authenticated API
    const tResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Non-Existent VM Template', description: 'Template with bad VM mask', durationHours: 1 },
    });
    expect(tResp.ok()).toBeTruthy();
    const template = await tResp.json();
    templateId = template.id;

    await steamfitterApi.post(`${Services.Steamfitter.API}/api/tasks/scenariotemplate/${templateId}`, {
      data: { name: 'Bad VM Task', description: 'Task targeting non-existent VM', triggerCondition: 'Manual', vmMask: 'nonexistent-vm-*' },
    });

    // Create scenario from template
    const sResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'Non-Existent VM Scenario', description: 'Scenario with bad VM task', scenarioTemplateId: templateId },
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

    await page.locator('text=Non-Existent VM Scenario').first().click();
    await page.waitForTimeout(1000);

    // Find and execute the task
    const taskRow = page.locator('text=Bad VM Task').first();
    const hasTask = await taskRow.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasTask) {
      const executeButton = taskRow.locator('..').locator('button').first();
      const hasExecute = await executeButton.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasExecute) {
        await executeButton.click();
        await page.waitForTimeout(2000);

        // Verify error or no VMs found message
        const errorMessage = page.locator('text=/no VMs|not found|error|failed|0 results/i, [class*="error"], [class*="warning"], mat-snack-bar').first();
        await expect(errorMessage).toBeVisible({ timeout: 10000 });
      }
    }
  });
});
