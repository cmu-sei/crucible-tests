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

  test('Delete Task from Scenario Template', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    // Create template and task via API
    const tResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Delete Task Template', description: 'Template with task to delete', durationHours: 1 },
    });
    expect(tResp.ok()).toBeTruthy();
    const template = await tResp.json();
    templateId = template.id;

    const taskResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/tasks`, {
      data: { name: 'Task To Delete', description: 'This task will be deleted', scenarioTemplateId: templateId, action: 'http_post', apiUrl: 'http', actionParameters: {}, triggerCondition: 'Manual', expectedOutput: '', delaySeconds: 0, intervalSeconds: 0, iterations: 1, iterationTermination: 'IterationCount', expirationSeconds: 0, vmMask: '', score: 0, userExecutable: false, repeatable: false },
    });
    expect(taskResp.ok()).toBeTruthy();

    // Navigate directly to the template in Scenario Templates tab
    await page.goto(`${Services.Steamfitter.UI}/?tab=Scenario%20Templates&scenarioTemplateId=${templateId}`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for the task to appear
    await expect(page.getByText('Task To Delete').first()).toBeVisible({ timeout: 15000 });

    // Open the task menu and click Delete
    const taskTreeItem = page.locator('mat-tree-node', { hasText: 'Task To Delete' }).first();
    await taskTreeItem.getByRole('button', { name: 'Task Menu' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    // Handle confirmation dialog if it appears
    const confirmDialog = page.getByRole('dialog');
    const hasConfirm = await confirmDialog.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasConfirm) {
      const confirmButton = confirmDialog.getByRole('button', { name: /Confirm|Delete|Yes/i }).first();
      const hasConfirmBtn = await confirmButton.isVisible({ timeout: 2000 }).catch(() => false);
      if (hasConfirmBtn) {
        await confirmButton.click();
      }
    }

    // Verify the task tree item is gone (use treeitem role to be more specific)
    await expect(page.locator('mat-tree-node', { hasText: 'Task To Delete' })).toHaveCount(0, { timeout: 10000 });
  });
});
