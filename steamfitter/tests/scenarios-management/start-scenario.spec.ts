// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

// The Player API (views, teams) runs on port 4300
const PLAYER_API = 'http://localhost:4300';

test.describe('Scenarios Management', () => {
  let templateId: string | null = null;
  let scenarioId: string | null = null;
  let viewId: string | null = null;

  test.afterEach(async ({ steamfitterApi, playerApi }) => {
    if (scenarioId) {
      try { await steamfitterApi.put(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}/end`, {}); } catch {}
      try { await steamfitterApi.delete(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}`); } catch {}
      scenarioId = null;
    }
    if (templateId) {
      try { await steamfitterApi.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${templateId}`); } catch {}
      templateId = null;
    }
    if (viewId) {
      try { await playerApi.delete(`${PLAYER_API}/api/views/${viewId}`); } catch {}
      viewId = null;
    }
  });

  test('Start Scenario', async ({ steamfitterAuthenticatedPage: page, steamfitterApi, playerApi }) => {
    // Create a Player View (required to start a scenario)
    const viewResp = await playerApi.post(`${PLAYER_API}/api/views`, {
      data: { name: 'View for Start Test', description: 'Test view', status: 'Active' },
    });
    expect(viewResp.ok()).toBeTruthy();
    const view = await viewResp.json();
    viewId = view.id;

    const templateResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Template for Start Test', description: 'Test template', durationHours: 1 },
    });
    expect(templateResp.ok()).toBeTruthy();
    const template = await templateResp.json();
    templateId = template.id;

    const scenarioResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'Scenario to Start', description: 'Start this scenario', scenarioTemplateId: templateId },
    });
    expect(scenarioResp.ok()).toBeTruthy();
    const scenario = await scenarioResp.json();
    scenarioId = scenario.id;

    // Associate the view with the scenario
    const updateResp = await steamfitterApi.put(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}`, {
      data: { ...scenario, viewId },
    });
    expect(updateResp.ok()).toBeTruthy();

    // Start the scenario via API (uses PUT)
    const startResp = await steamfitterApi.put(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}/start`, {});
    expect(startResp.ok()).toBeTruthy();

    // Navigate to the Scenarios list and verify it shows as active
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.locator('mat-list').getByText('Scenarios', { exact: true }).click();

    const scenarioRow = page.getByRole('row', { name: /Scenario to Start/ });
    await expect(scenarioRow.getByText(/active/i)).toBeVisible();
  });
});
