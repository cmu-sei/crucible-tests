// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('URL and Navigation Enhancements', () => {
  let templateId: string | null = null;
  let taskId: string | null = null;

  test.afterEach(async ({ request }) => {
    if (templateId) {
      try {
        await request.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${templateId}`);
      } catch { /* ignore cleanup errors */ }
      templateId = null;
    }
  });

  test('Deep Link to Task Query Param', async ({ steamfitterAuthenticatedPage: page, request }) => {
    // Setup: create template with task via API
    const createTemplateResp = await request.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Deep Link Task Test', description: 'Test deep link to task', durationHours: 1 },
    });
    expect(createTemplateResp.ok()).toBeTruthy();
    const template = await createTemplateResp.json();
    templateId = template.id;

    // Add a task
    const createTaskResp = await request.post(`${Services.Steamfitter.API}/api/tasks/scenariotemplate/${templateId}`, {
      data: { name: 'Deep Link Task', description: 'Task for deep link test', triggerCondition: 'Manual' },
    });
    if (createTaskResp.ok()) {
      const task = await createTaskResp.json();
      taskId = task.id;
    }

    // Navigate with template and task query params
    await page.goto(`${Services.Steamfitter.UI}/admin?template=${templateId}&task=${taskId}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Verify the task is highlighted/visible
    const taskElement = page.locator('text=Deep Link Task').first();
    const isVisible = await taskElement.isVisible({ timeout: 10000 }).catch(() => false);
    expect(isVisible).toBe(true);

    // Verify the template is also selected
    const templateElement = page.locator('text=Deep Link Task Test').first();
    const templateVisible = await templateElement.isVisible({ timeout: 5000 }).catch(() => false);
    expect(templateVisible).toBe(true);
  });
});
