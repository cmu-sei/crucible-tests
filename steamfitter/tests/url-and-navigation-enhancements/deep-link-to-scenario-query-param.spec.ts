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

  test('Deep Link to Scenario Query Param', async ({ steamfitterAuthenticatedPage: page, request }) => {
    // Setup: create template and scenario via API
    const createTemplateResp = await request.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Deep Link Scenario Test', description: 'Test deep link', durationHours: 1 },
    });
    expect(createTemplateResp.ok()).toBeTruthy();
    const template = await createTemplateResp.json();
    templateId = template.id;

    const createScenarioResp = await request.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'Deep Link Scenario', description: 'Test scenario', scenarioTemplateId: templateId, durationHours: 1 },
    });
    expect(createScenarioResp.ok()).toBeTruthy();
    const scenario = await createScenarioResp.json();
    scenarioId = scenario.id;

    // Navigate to admin with scenario query parameter
    await page.goto(`${Services.Steamfitter.UI}/admin?scenario=${scenarioId}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Verify the scenario is selected/highlighted
    const scenarioElement = page.locator(`text=Deep Link Scenario`).first();
    const isVisible = await scenarioElement.isVisible({ timeout: 10000 }).catch(() => false);
    expect(isVisible).toBe(true);

    // Switch sections (e.g., to Scenario Templates)
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });
    await sidebar.locator('text=Scenario Templates').first().click();
    await page.waitForTimeout(1000);

    // Verify query param is cleaned from URL
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('scenario=');
  });
});
