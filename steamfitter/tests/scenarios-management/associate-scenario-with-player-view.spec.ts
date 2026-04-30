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

  test('Associate Scenario with Player View', async ({ steamfitterAuthenticatedPage: page, steamfitterApi, playerApi }) => {
    // Create a Player View
    const viewResp = await playerApi.post(`${PLAYER_API}/api/views`, {
      data: { name: 'View for Association Test', description: 'Test view', status: 'Active' },
    });
    expect(viewResp.ok()).toBeTruthy();
    const view = await viewResp.json();
    viewId = view.id;

    const templateResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Template for View Association', description: 'Test template', durationHours: 1 },
    });
    expect(templateResp.ok()).toBeTruthy();
    const template = await templateResp.json();
    templateId = template.id;

    const scenarioResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'Scenario for View Test', description: 'Associate with view', scenarioTemplateId: templateId },
    });
    expect(scenarioResp.ok()).toBeTruthy();
    const scenario = await scenarioResp.json();
    scenarioId = scenario.id;

    // Associate the view with the scenario via API
    const updateResp = await steamfitterApi.put(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}`, {
      data: { ...scenario, viewId },
    });
    expect(updateResp.ok()).toBeTruthy();

    // Verify the updated scenario has the viewId set via API
    const getResp = await steamfitterApi.get(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}`);
    expect(getResp.ok()).toBeTruthy();
    const updatedScenario = await getResp.json();
    expect(updatedScenario.viewId).toBe(viewId);

    // Navigate to the Scenarios list and verify the view is shown
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.locator('mat-list').getByText('Scenarios', { exact: true }).click();
    const scenarioRow = page.getByRole('row', { name: /Scenario for View Test/ });
    await expect(scenarioRow).toBeVisible();
  });
});
