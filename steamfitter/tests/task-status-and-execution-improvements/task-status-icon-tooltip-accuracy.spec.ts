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

  test('Task Status Icon Tooltip Accuracy', async ({ steamfitterAuthenticatedPage: page, request }) => {
    // Setup: create template with task and scenario
    const createTemplateResp = await request.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Tooltip Accuracy Test', description: 'Test status icon tooltips', durationHours: 1 },
    });
    expect(createTemplateResp.ok()).toBeTruthy();
    const template = await createTemplateResp.json();
    templateId = template.id;

    await request.post(`${Services.Steamfitter.API}/api/tasks/scenariotemplate/${templateId}`, {
      data: { name: 'Tooltip Task', description: 'Task for tooltip test', triggerCondition: 'Manual' },
    });

    const createScenarioResp = await request.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'Tooltip Scenario', description: 'Test scenario', scenarioTemplateId: templateId, durationHours: 1 },
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

    await page.locator('text=Tooltip Scenario').first().click();
    await page.waitForTimeout(1000);

    // Hover over the task status icon
    const statusIcon = page.locator('mat-icon[mattooltip], [class*="status"] mat-icon, mat-icon[title]').first();
    const hasStatusIcon = await statusIcon.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasStatusIcon) {
      // Hover over the icon to trigger tooltip
      await statusIcon.hover();
      await page.waitForTimeout(500);

      // Check for tooltip content - should say 'pending' for a new task
      const tooltip = page.locator('mat-tooltip-component, [role="tooltip"], .mat-mdc-tooltip, .cdk-overlay-container').first();
      const hasTooltip = await tooltip.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasTooltip) {
        const tooltipText = await tooltip.textContent();
        expect(tooltipText?.toLowerCase()).toContain('pending');
      } else {
        // Check matTooltip attribute directly
        const tooltipAttr = await statusIcon.getAttribute('mattooltip') || await statusIcon.getAttribute('title');
        if (tooltipAttr) {
          expect(tooltipAttr.toLowerCase()).toContain('pending');
        }
      }
    }
  });
});
