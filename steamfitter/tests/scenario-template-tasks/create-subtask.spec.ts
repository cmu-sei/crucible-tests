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

  test('Create Subtask', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    // Create template and parent task via API
    const tResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Subtask Template', description: 'Template for subtask creation', durationHours: 1 },
    });
    expect(tResp.ok()).toBeTruthy();
    const template = await tResp.json();
    templateId = template.id;

    const parentTaskResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/tasks`, {
      data: { name: 'Parent Task', description: 'Parent task for subtask test', scenarioTemplateId: templateId, action: 'http_post', apiUrl: 'http', actionParameters: {}, triggerCondition: 'Manual', expectedOutput: '', delaySeconds: 0, intervalSeconds: 0, iterations: 1, iterationTermination: 'IterationCount', expirationSeconds: 0, vmMask: '', score: 0, userExecutable: false, repeatable: false },
    });
    expect(parentTaskResp.ok()).toBeTruthy();
    const parentTask = await parentTaskResp.json();

    // Navigate to home page and switch to Scenario Templates tab
    await page.goto(Services.Steamfitter.UI);
    const myButton = page.getByRole('button', { name: /My Scenarios/i });
    await expect(myButton).toBeVisible({ timeout: 15000 });
    await myButton.click();
    await page.getByRole('menuitem', { name: 'Scenario Templates' }).click();

    // Click on the template to expand it
    await expect(page.getByRole('cell', { name: 'Subtask Template' })).toBeVisible({ timeout: 10000 });
    await page.getByRole('cell', { name: 'Subtask Template' }).click();

    // Wait for the task to appear
    await expect(page.getByText('Parent Task').first()).toBeVisible({ timeout: 15000 });

    // Open the task menu and click "New" to create a subtask
    const taskTreeItem = page.locator('mat-tree-node', { hasText: 'Parent Task' }).first();
    await taskTreeItem.getByRole('button', { name: 'Task Menu' }).click();
    await page.getByRole('menuitem', { name: 'New' }).click();

    // Fill in the subtask edit dialog
    const taskDialog = page.getByRole('dialog', { name: /Task/i });
    await expect(taskDialog).toBeVisible({ timeout: 5000 });

    await taskDialog.getByLabel('Name').fill('Verify VM Status');

    // Select an action (required for saving) - use the combobox
    await taskDialog.getByRole('combobox', { name: 'Select an Action' }).click();
    // Wait for the dropdown options
    const httpOption = page.locator('mat-option').filter({ hasText: /http/i }).first();
    await expect(httpOption).toBeVisible({ timeout: 5000 });
    await httpOption.click();

    await taskDialog.getByRole('button', { name: 'Save' }).click();

    // Wait for dialog to close
    await expect(taskDialog).toBeHidden({ timeout: 5000 });

    // Expand the parent task to see its subtask (click the expand button)
    const expandButton = taskTreeItem.locator('button').first();
    await expandButton.click();

    // Verify the subtask appears - may be nested under parent
    await expect(page.getByText('Verify VM Status').first()).toBeVisible({ timeout: 10000 });
  });
});
