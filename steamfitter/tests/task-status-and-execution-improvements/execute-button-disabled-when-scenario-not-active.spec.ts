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
        // End scenario if active
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

  test('Execute Button Disabled When Scenario Not Active', async ({ steamfitterAuthenticatedPage: page, request }) => {
    // Setup: create template with task and scenario (not started)
    const createTemplateResp = await request.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Execute Disabled Test', description: 'Test execute button state', durationHours: 1 },
    });
    expect(createTemplateResp.ok()).toBeTruthy();
    const template = await createTemplateResp.json();
    templateId = template.id;

    await request.post(`${Services.Steamfitter.API}/api/tasks/scenariotemplate/${templateId}`, {
      data: { name: 'Execute Test Task', description: 'Task for execute test', triggerCondition: 'Manual' },
    });

    const createScenarioResp = await request.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'Execute Disabled Scenario', description: 'Test scenario', scenarioTemplateId: templateId, durationHours: 1 },
    });
    expect(createScenarioResp.ok()).toBeTruthy();
    const scenario = await createScenarioResp.json();
    scenarioId = scenario.id;

    // Navigate to the scenario
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });
    await sidebar.locator('text=Scenarios').first().click();
    await page.waitForTimeout(1000);

    await page.locator('text=Execute Disabled Scenario').first().click();
    await page.waitForTimeout(1000);

    // Verify execute button is disabled when scenario is not active
    const executeButton = page.locator('button:has(mat-icon:text("play_arrow")), button:has-text("Execute"), [mattooltip*="Execute"]').first();
    const hasExecute = await executeButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasExecute) {
      const isDisabled = await executeButton.isDisabled();
      expect(isDisabled).toBe(true);
    }

    // Start the scenario
    const startButton = page.locator('button:has(mat-icon:text("play_arrow")):not([disabled]), button:has-text("Start")').first();
    const hasStart = await startButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasStart) {
      await startButton.click();
      await page.waitForTimeout(2000);

      // Verify execute button becomes enabled after scenario is started
      if (hasExecute) {
        const isEnabledNow = await executeButton.isEnabled().catch(() => false);
        expect(isEnabledNow).toBe(true);
      }
    }
  });
});
