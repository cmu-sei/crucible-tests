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

  test('View Task Points and Score Panel', async ({ steamfitterAuthenticatedPage: page, request }) => {
    // Create template with scored tasks
    const templateResp = await request.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Template Scored Tasks', description: 'Has scored tasks', durationHours: 1 },
    });
    expect(templateResp.ok()).toBeTruthy();
    const template = await templateResp.json();
    templateId = template.id;

    // Add scored tasks
    await request.post(`${Services.Steamfitter.API}/api/tasks/scenariotemplate/${templateId}`, {
      data: { name: 'Scored Task 1', description: 'Worth 10 points', triggerCondition: 'Manual', isUserExecutable: true, totalScore: 10 },
    });
    await request.post(`${Services.Steamfitter.API}/api/tasks/scenariotemplate/${templateId}`, {
      data: { name: 'Scored Task 2', description: 'Worth 20 points', triggerCondition: 'Manual', isUserExecutable: true, totalScore: 20 },
    });

    // Create scenario
    const scenarioResp = await request.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'Scenario with Scores', description: 'Score panel', scenarioTemplateId: templateId },
    });
    expect(scenarioResp.ok()).toBeTruthy();
    const scenario = await scenarioResp.json();
    scenarioId = scenario.id;

    // Navigate to tasks page
    await page.goto(`${Services.Steamfitter.UI}/scenario/${scenarioId}`);

    // Verify score panel is visible
    await expect(page.locator('text=/score|points/i').first()).toBeVisible();
  });
});
