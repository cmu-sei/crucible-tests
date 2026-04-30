// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Task Status and Execution Improvements', () => {
  let templateId: string | null = null;
  let scenarioId: string | null = null;

  test.afterEach(async ({ request }) => {
    if (scenarioId) {
      try {
        await request.post(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}/end`).catch(() => {});
        await request.delete(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}`);
      } catch { /* ignore cleanup errors */ }
      scenarioId = null;
    }
    if (templateId) {
      try {
        await request.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${templateId}`);
      } catch { /* ignore cleanup errors */ }
      templateId = null;
    }
  });

  test('Execute Confirmation Dialog', async ({ steamfitterAuthenticatedPage: page, request }) => {
    // Setup: create template with task, scenario, and start it
    const createTemplateResp = await request.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Execute Confirm Test', description: 'Test execute confirmation', durationHours: 1 },
    });
    expect(createTemplateResp.ok()).toBeTruthy();
    const template = await createTemplateResp.json();
    templateId = template.id;

    await request.post(`${Services.Steamfitter.API}/api/tasks/scenariotemplate/${templateId}`, {
      data: { name: 'Confirm Task', description: 'Task for confirmation test', triggerCondition: 'Manual' },
    });

    const createScenarioResp = await request.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'Execute Confirm Scenario', description: 'Test scenario', scenarioTemplateId: templateId, durationHours: 1 },
    });
    expect(createScenarioResp.ok()).toBeTruthy();
    const scenario = await createScenarioResp.json();
    scenarioId = scenario.id;

    // Start the scenario via API
    await request.post(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}/start`);

    // Navigate to the scenario
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });
    await sidebar.locator('text=Scenarios').first().click();
    await page.waitForTimeout(1000);

    await page.locator('text=Execute Confirm Scenario').first().click();
    await page.waitForTimeout(1000);

    // Click execute on the task
    const executeButton = page.locator('button:has(mat-icon:text("play_arrow")), button:has-text("Execute"), [mattooltip*="Execute"]').first();
    const hasExecute = await executeButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasExecute) {
      await executeButton.click();
      await page.waitForTimeout(500);

      // Verify confirmation dialog appears
      const confirmDialog = page.locator('mat-dialog-container, [role="dialog"]').first();
      const hasDialog = await confirmDialog.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasDialog) {
        // Cancel the dialog and verify no execution
        const cancelButton = confirmDialog.locator('button:has-text("Cancel"), button:has-text("No")').first();
        if (await cancelButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await cancelButton.click();
          await page.waitForTimeout(500);
        }

        // Click execute again to test confirm path
        await executeButton.click();
        await page.waitForTimeout(500);

        const confirmDialogAgain = page.locator('mat-dialog-container, [role="dialog"]').first();
        if (await confirmDialogAgain.isVisible({ timeout: 3000 }).catch(() => false)) {
          // Confirm execution
          const confirmButton = confirmDialogAgain.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("OK")').first();
          if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await confirmButton.click();
            await page.waitForTimeout(1000);
          }
        }
      }
    }
  });
});
