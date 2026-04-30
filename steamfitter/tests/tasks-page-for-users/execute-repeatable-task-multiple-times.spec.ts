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

  test('Execute Repeatable Task Multiple Times', async ({ steamfitterAuthenticatedPage: page, request }) => {
    // Create template with repeatable task
    const templateResp = await request.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Template Repeatable Task', description: 'Repeatable task', durationHours: 1 },
    });
    expect(templateResp.ok()).toBeTruthy();
    const template = await templateResp.json();
    templateId = template.id;

    // Add a repeatable task
    await request.post(`${Services.Steamfitter.API}/api/tasks/scenariotemplate/${templateId}`, {
      data: { name: 'Repeatable Task', description: 'Can be repeated', triggerCondition: 'Manual', isUserExecutable: true, repeatable: true },
    });

    // Create scenario
    const scenarioResp = await request.post(`${Services.Steamfitter.API}/api/scenarios`, {
      data: { name: 'Scenario Repeatable', description: 'Repeat task', scenarioTemplateId: templateId },
    });
    expect(scenarioResp.ok()).toBeTruthy();
    const scenario = await scenarioResp.json();
    scenarioId = scenario.id;

    // Navigate to tasks page
    await page.goto(`${Services.Steamfitter.UI}/scenario/${scenarioId}`);

    // Execute task first time
    await page.getByText('Repeatable Task').click();
    const executeButton = page.getByRole('button', { name: /execute|run/i }).first();
    await executeButton.click();
    await expect(page.locator('text=/result|success|executed/i').first()).toBeVisible();

    // Execute task second time
    await executeButton.click();
    await expect(page.locator('text=/result|success|executed/i').first()).toBeVisible();

    // Verify button is still enabled (task is repeatable)
    await expect(executeButton).toBeEnabled();
  });
});
