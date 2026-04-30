// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Tasks Page for Users', () => {
  let templateId: string | null = null;
  let scenarioId: string | null = null;

  test.afterEach(async ({ request }) => {
    if (scenarioId) {
      try { await request.post(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}/end`); } catch {}
      try { await request.delete(`${Services.Steamfitter.API}/api/scenarios/${scenarioId}`); } catch {}
      scenarioId = null;
    }
    if (templateId) {
      try { await request.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${templateId}`); } catch {}
      templateId = null;
    }
  });

  test('Access Tasks via View ID', async ({ steamfitterAuthenticatedPage: page, request }) => {
    // Create template
    const templateResp = await request.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Template for View Access', description: 'Has tasks', durationHours: 1 },
    });
    expect(templateResp.ok()).toBeTruthy();
    const template = await templateResp.json();
    templateId = template.id;

    // Add a task to the template
    await request.post(`${Services.Steamfitter.API}/api/tasks/scenariotemplate/${templateId}`, {
      data: { name: 'View Task 1', description: 'Task accessed via view', triggerCondition: 'Manual' },
    });

    // Create scenario associated with a view
    const scenarioResp = await request.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'Scenario for View Access', description: 'Access via view', scenarioTemplateId: templateId, viewId: '00000000-0000-0000-0000-000000000001' },
    });
    expect(scenarioResp.ok()).toBeTruthy();
    const scenario = await scenarioResp.json();
    scenarioId = scenario.id;
    const viewId = scenario.viewId;

    // Navigate to tasks page via view ID
    await page.goto(`${Services.Steamfitter.UI}/view/${viewId}`);

    await expect(page.locator('text=/task/i').first()).toBeVisible();
  });
});
