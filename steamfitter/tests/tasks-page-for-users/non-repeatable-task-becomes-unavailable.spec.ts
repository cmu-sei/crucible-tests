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

  test('Non-Repeatable Task Becomes Unavailable After Execution', async ({ steamfitterAuthenticatedPage: page, request }) => {
    // Create template with non-repeatable task
    const templateResp = await request.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Template Non-Repeatable', description: 'Non-repeatable task', durationHours: 1 },
    });
    expect(templateResp.ok()).toBeTruthy();
    const template = await templateResp.json();
    templateId = template.id;

    // Add a non-repeatable task
    await request.post(`${Services.Steamfitter.API}/api/tasks/scenariotemplate/${templateId}`, {
      data: { name: 'One-Time Task', description: 'Cannot repeat', triggerCondition: 'Manual', isUserExecutable: true, repeatable: false },
    });

    // Create scenario
    const scenarioResp = await request.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'Scenario Non-Repeatable', description: 'One-time task', scenarioTemplateId: templateId },
    });
    expect(scenarioResp.ok()).toBeTruthy();
    const scenario = await scenarioResp.json();
    scenarioId = scenario.id;

    // Navigate to tasks page
    await page.goto(`${Services.Steamfitter.UI}/scenario/${scenarioId}`);

    // Execute task
    await page.getByText('One-Time Task').click();
    const executeButton = page.getByRole('button', { name: /execute|run/i }).first();
    await executeButton.click();

    await expect(page.locator('text=/result|success|executed/i').first()).toBeVisible();

    // Verify button is now disabled
    await expect(executeButton).toBeDisabled();
  });
});
