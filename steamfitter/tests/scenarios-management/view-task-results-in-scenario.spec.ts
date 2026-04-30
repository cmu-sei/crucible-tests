// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Scenarios Management', () => {
  let templateId: string | null = null;
  let scenarioId: string | null = null;

  test.afterEach(async ({ steamfitterApi }) => {
    if (scenarioId) {
      try { await steamfitterApi.delete(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}`); } catch {}
      scenarioId = null;
    }
    if (templateId) {
      try { await steamfitterApi.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${templateId}`); } catch {}
      templateId = null;
    }
  });

  test('View Task Results in Scenario', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    // Create template with a task
    const templateResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Template with Task Results', description: 'Has tasks', durationHours: 1 },
    });
    expect(templateResp.ok()).toBeTruthy();
    const template = await templateResp.json();
    templateId = template.id;

    // Add a task to the template via POST /api/tasks
    const taskResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/tasks`, {
      data: {
        name: 'Task with Results',
        description: 'View results for this task',
        scenarioTemplateId: template.id,
        triggerCondition: 'Manual',
        action: 'http_get',
        apiUrl: 'http://localhost:4400/api/health/live',
        actionParameters: {},
      },
    });
    expect(taskResp.ok()).toBeTruthy();

    // Create scenario from template via the templates/{id}/scenarios endpoint so tasks are copied.
    // The plain POST /api/scenarios endpoint does not clone template tasks into the new scenario.
    const scenarioResp = await steamfitterApi.post(
      `${Services.Steamfitter.API}/api/scenariotemplates/${templateId}/scenarios`,
      {
        data: { name: 'Scenario with Task Results', description: 'View results' },
      }
    );
    expect(scenarioResp.ok()).toBeTruthy();
    const scenario = await scenarioResp.json();
    scenarioId = scenario.id;

    // The scenario list/task tree lives on the home page (not /admin). Navigate directly to the
    // scenario by id so the Tasks panel becomes visible.
    await page.goto(`${Services.Steamfitter.UI}/?scenarioId=${scenarioId}`);

    // Expand task to see results. The task is a Material expansion panel header whose title
    // contains the task name. Click the header to expand and reveal the task details region.
    const taskHeader = page.locator('mat-expansion-panel-header', { hasText: 'Task with Results' });
    await expect(taskHeader).toBeVisible();
    await taskHeader.click();

    await expect(
      page.locator('mat-expansion-panel.mat-expanded region, mat-expansion-panel.mat-expanded [role="region"]').first()
    ).toBeVisible();
  });
});
