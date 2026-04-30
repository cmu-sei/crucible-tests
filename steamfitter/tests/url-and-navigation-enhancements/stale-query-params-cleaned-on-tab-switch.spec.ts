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

  test('Stale Query Params Cleaned on Tab Switch', async ({ steamfitterAuthenticatedPage: page, request }) => {
    // Setup: create template and scenario
    const createTemplateResp = await request.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Stale Params Test', description: 'Test stale params cleanup', durationHours: 1 },
    });
    expect(createTemplateResp.ok()).toBeTruthy();
    const template = await createTemplateResp.json();
    templateId = template.id;

    const createScenarioResp = await request.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'Stale Params Scenario', description: 'Test scenario', scenarioTemplateId: templateId, durationHours: 1 },
    });
    expect(createScenarioResp.ok()).toBeTruthy();
    const scenario = await createScenarioResp.json();
    scenarioId = scenario.id;

    // Navigate with query params
    await page.goto(`${Services.Steamfitter.UI}/admin?scenario=${scenarioId}&template=${templateId}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Verify query params are in the URL
    let currentUrl = page.url();
    const hasParams = currentUrl.includes('scenario=') || currentUrl.includes('template=');
    expect(hasParams).toBe(true);

    // Switch sidebar section
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });
    await sidebar.locator('text=Scenario Templates').first().click();
    await page.waitForTimeout(1000);

    // Verify URL is cleaned of stale query params
    currentUrl = page.url();
    expect(currentUrl).not.toContain('scenario=');

    // Switch to another section
    await sidebar.locator('text=Scenarios').first().click();
    await page.waitForTimeout(1000);

    currentUrl = page.url();
    expect(currentUrl).not.toContain('template=');
  });
});
