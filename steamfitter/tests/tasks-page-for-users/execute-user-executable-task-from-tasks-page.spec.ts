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

  test('Execute User-Executable Task from Tasks Page', async ({ steamfitterAuthenticatedPage: page, request }) => {
    // Create template with user-executable task
    const templateResp = await request.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Template User Exec Task', description: 'User executable', durationHours: 1 },
    });
    expect(templateResp.ok()).toBeTruthy();
    const template = await templateResp.json();
    templateId = template.id;

    // Add a user-executable task
    await request.post(`${Services.Steamfitter.API}/api/tasks/scenariotemplate/${templateId}`, {
      data: { name: 'User Executable Task', description: 'Can be executed by user', triggerCondition: 'Manual', isUserExecutable: true },
    });

    // Create scenario
    const scenarioResp = await request.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'Scenario User Exec', description: 'Execute from tasks page', scenarioTemplateId: templateId },
    });
    expect(scenarioResp.ok()).toBeTruthy();
    const scenario = await scenarioResp.json();
    scenarioId = scenario.id;

    // Navigate to tasks page
    await page.goto(`${Services.Steamfitter.UI}/scenario/${scenarioId}`);

    // Click on the task to execute it
    await page.getByText('User Executable Task').click();
    await page.getByRole('button', { name: /execute|run/i }).first().click();

    await expect(page.locator('text=/result|success|executed/i').first()).toBeVisible();
  });
});
