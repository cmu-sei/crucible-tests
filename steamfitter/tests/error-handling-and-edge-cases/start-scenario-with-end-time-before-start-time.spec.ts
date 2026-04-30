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

  test('Start Scenario with End Time Before Start Time', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    // Setup: create template and scenario via authenticated API
    const tResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Invalid Times Template', description: 'Template for invalid times test', durationHours: 1 },
    });
    expect(tResp.ok()).toBeTruthy();
    const template = await tResp.json();
    templateId = template.id;

    const sResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'Invalid Times Scenario', description: 'Scenario with invalid times', scenarioTemplateId: templateId },
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

    await page.locator('text=Invalid Times Scenario').first().click();
    await page.waitForTimeout(1000);

    // Try to set end time before start time via the API (since UI date inputs may vary)
    // First, attempt to start the scenario with invalid times via the API
    const pastDate = new Date('2020-01-01T00:00:00Z').toISOString();
    const futureDate = new Date('2030-12-31T23:59:00Z').toISOString();

    const updateResp = await steamfitterApi.put(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}`, {
      data: {
        id: scenarioId,
        name: 'Invalid Times Scenario',
        description: 'Scenario with invalid times',
        scenarioTemplateId: templateId,
        startDate: futureDate,
        endDate: pastDate,
      },
    });

    // The API should reject or the scenario should have validation issues
    // Either the API rejects the invalid times (not ok) or the UI shows an error/warning
    if (!updateResp.ok()) {
      // API correctly rejected invalid times
      expect(updateResp.ok()).toBeFalsy();
    } else {
      // If API accepted it, try to start the scenario and expect failure
      const startResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}/start`, {});
      // Starting a scenario with end time before start time should fail or show a warning
      const startedOk = startResp.ok();
      // Either it failed (expected) or the page shows the issue
      expect(startedOk).toBeFalsy();
    }
  });
});
