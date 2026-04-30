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

  test('Execute Manual Task in Active Scenario', async ({ steamfitterAuthenticatedPage: page, steamfitterApi, playerApi }) => {
    // Create a Player View
    const viewResp = await playerApi.post(`${PLAYER_API}/api/views`, {
      data: { name: 'View for Task Test', description: 'Test view', status: 'Active' },
    });
    expect(viewResp.ok()).toBeTruthy();
    const view = await viewResp.json();
    viewId = view.id;

    // Create template
    const templateResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Template with Manual Task', description: 'Has manual task', durationHours: 1 },
    });
    expect(templateResp.ok()).toBeTruthy();
    const template = await templateResp.json();
    templateId = template.id;

    // Add a task to the template via POST /api/tasks
    const taskResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/tasks`, {
      data: {
        name: 'Manual Task',
        description: 'A manual task',
        scenarioTemplateId: template.id,
        triggerCondition: 'Manual',
        action: 'http_get',
        apiUrl: 'http://localhost:4400/api/health/live',
        actionParameters: {},
        userExecutable: true,
      },
    });
    expect(taskResp.ok()).toBeTruthy();

    // Create scenario from template. Using POST /api/scenarios directly does NOT copy
    // the template's tasks into the new scenario; the dedicated "create from template"
    // endpoint is required for tasks to be cloned onto the new scenario.
    const scenarioResp = await steamfitterApi.post(
      `${Services.Steamfitter.API}/api/scenariotemplates/${templateId}/scenarios`,
      { data: { nameSuffix: ' - Run' } },
    );
    expect(scenarioResp.ok()).toBeTruthy();
    const scenario = await scenarioResp.json();
    scenarioId = scenario.id;
    const scenarioName: string = scenario.name;

    // Associate view and start scenario
    await steamfitterApi.put(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}`, {
      data: { ...scenario, viewId },
    });
    const startResp = await steamfitterApi.put(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}/start`, {});
    expect(startResp.ok()).toBeTruthy();

    // Navigate to the user-facing scenarios page. The admin view only shows
    // memberships for a scenario, not its tasks.
    await page.goto(`${Services.Steamfitter.UI}/`);

    // Open the scenario row to reveal its Tasks section
    await page.getByRole('cell', { name: scenarioName, exact: true }).click();

    // Expand the Manual Task panel to reveal the Task Menu (which is where
    // the Execute action is available when the scenario is active)
    const taskPanel = page.getByRole('button', { name: 'Manual Task' }).first();
    await expect(taskPanel).toBeVisible();
    await taskPanel.click();

    // Open the Task Menu and click Execute
    await page.getByRole('button', { name: 'Task Menu' }).first().click();
    await page.getByRole('menuitem', { name: 'Execute' }).click();

    // A confirmation dialog appears asking whether to execute the task
    const confirmDialog = page.getByRole('dialog', { name: /Execute Task/i });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText(/Manual Task/i);
    await confirmDialog.getByRole('button', { name: 'Yes' }).click();

    // The dialog closes once the execute request is submitted, which is
    // the visible signal that the manual task was executed.
    await expect(confirmDialog).toBeHidden();
  });
});
