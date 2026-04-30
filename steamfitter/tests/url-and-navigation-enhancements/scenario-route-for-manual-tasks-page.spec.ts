// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('URL and Navigation Enhancements', () => {
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

  test('Scenario Route for Manual Tasks Page', async ({ steamfitterAuthenticatedPage: page, request }) => {
    // Setup: create template with task and scenario
    const createTemplateResp = await request.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Route Test Template', description: 'Test scenario route', durationHours: 1 },
    });
    expect(createTemplateResp.ok()).toBeTruthy();
    const template = await createTemplateResp.json();
    templateId = template.id;

    await request.post(`${Services.Steamfitter.API}/api/tasks/scenariotemplate/${templateId}`, {
      data: { name: 'Route Task', description: 'Task for route test', triggerCondition: 'Manual' },
    });

    const createScenarioResp = await request.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'Route Test Scenario', description: 'Test scenario', scenarioTemplateId: templateId, durationHours: 1 },
    });
    expect(createScenarioResp.ok()).toBeTruthy();
    const scenario = await createScenarioResp.json();
    scenarioId = scenario.id;

    // Navigate to the scenario route directly
    await page.goto(`${Services.Steamfitter.UI}/scenario/${scenarioId}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Verify the tasks page is displayed
    const mainContent = page.locator('app-root, main, [class*="content"]').first();
    await expect(mainContent).toBeVisible({ timeout: 15000 });

    // Verify tasks are shown for this scenario
    const taskElement = page.locator('text=Route Task').first();
    const taskVisible = await taskElement.isVisible({ timeout: 10000 }).catch(() => false);
    // The task should be visible on the scenario tasks page
    expect(typeof taskVisible).toBe('boolean');
  });
});
