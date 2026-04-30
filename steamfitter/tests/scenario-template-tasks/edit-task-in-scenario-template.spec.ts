// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Scenario Template Tasks', () => {
  let templateId: string | null = null;

  test.afterEach(async ({ steamfitterApi }) => {
    if (templateId) {
      try { await steamfitterApi.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${templateId}`); } catch {}
      templateId = null;
    }
  });

  test('Edit Task in Scenario Template', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    // Create template and task via API
    const tResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Edit Task Template', description: 'Template with task to edit', durationHours: 1 },
    });
    expect(tResp.ok()).toBeTruthy();
    const template = await tResp.json();
    templateId = template.id;

    const taskResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/tasks`, {
      data: { name: 'Original Task Name', description: 'Task to be edited', scenarioTemplateId: templateId, action: 'http_post', apiUrl: 'http', actionParameters: {}, triggerCondition: 'Manual', expectedOutput: '', delaySeconds: 0, intervalSeconds: 0, iterations: 1, iterationTermination: 'IterationCount', expirationSeconds: 0, vmMask: '', score: 0, userExecutable: false, repeatable: false },
    });
    expect(taskResp.ok()).toBeTruthy();

    // Navigate directly to the template in Scenario Templates tab
    await page.goto(`${Services.Steamfitter.UI}/?tab=Scenario%20Templates&scenarioTemplateId=${templateId}`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for template row, then expand it - retry expansion if SignalR causes re-render
    await expect(page.getByRole('cell', { name: 'Edit Task Template' })).toBeVisible({ timeout: 15000 });
    for (let attempt = 0; attempt < 5; attempt++) {
      if (await page.getByText('Original Task Name').first().isVisible().catch(() => false)) break;
      await page.getByRole('cell', { name: 'Edit Task Template' }).click();
      await page.waitForTimeout(1000);
    }
    await expect(page.getByText('Original Task Name').first()).toBeVisible({ timeout: 15000 });

    // Open the task menu and click Edit - retry if menu gets dismissed by UI re-render
    const editMenuItem = page.getByRole('menuitem', { name: 'Edit' });
    for (let attempt = 0; attempt < 3; attempt++) {
      const taskTreeItem = page.locator('mat-tree-node', { hasText: 'Original Task Name' }).first();
      await taskTreeItem.getByRole('button', { name: 'Task Menu' }).click();
      if (await editMenuItem.isVisible({ timeout: 2000 }).catch(() => false)) break;
      await page.waitForTimeout(500);
    }
    await editMenuItem.click();

    // Edit the task name in the dialog
    const taskDialog = page.getByRole('dialog', { name: /Task/i });
    await expect(taskDialog).toBeVisible({ timeout: 5000 });

    const nameField = taskDialog.getByLabel('Name');
    await nameField.clear();
    await nameField.fill('Updated Power On VM');

    // Click Save and wait for the task update API call to complete
    const saveResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/tasks') && resp.request().method() === 'PUT' && resp.status() === 200,
    );
    await taskDialog.getByRole('button', { name: 'Save' }).click();
    await saveResponsePromise;

    // Wait for dialog to close
    await expect(taskDialog).toBeHidden({ timeout: 5000 });

    // After save, SignalR may cause the view to re-render and switch tabs.
    // Re-navigate to the template to ensure we're on the correct view.
    await page.goto(`${Services.Steamfitter.UI}/?tab=Scenario%20Templates&scenarioTemplateId=${templateId}`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for template row and expand it to see the updated task
    await expect(page.getByRole('cell', { name: 'Edit Task Template' })).toBeVisible({ timeout: 15000 });
    for (let attempt = 0; attempt < 5; attempt++) {
      if (await page.getByText('Updated Power On VM').first().isVisible().catch(() => false)) break;
      await page.getByRole('cell', { name: 'Edit Task Template' }).click();
      await page.waitForTimeout(1000);
    }

    // Verify the updated name appears
    await expect(page.getByText('Updated Power On VM').first()).toBeVisible({ timeout: 10000 });
  });
});
