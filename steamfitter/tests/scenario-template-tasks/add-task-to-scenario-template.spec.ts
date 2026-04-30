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

  test('Add Task to Scenario Template', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    const resp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Add Task Template', description: 'Template for adding tasks', durationHours: 1 },
    });
    expect(resp.ok()).toBeTruthy();
    const template = await resp.json();
    templateId = template.id;

    // Navigate to home page and switch to Scenario Templates tab
    await page.goto(Services.Steamfitter.UI);
    const myButton = page.getByRole('button', { name: /My Scenarios/i });
    await expect(myButton).toBeVisible({ timeout: 15000 });
    await myButton.click();
    await page.getByRole('menuitem', { name: 'Scenario Templates' }).click();

    // Click on the template to expand it (non-admin mode shows tasks)
    await expect(page.getByRole('cell', { name: 'Add Task Template' })).toBeVisible({ timeout: 10000 });
    await page.getByRole('cell', { name: 'Add Task Template' }).click();

    // Wait for the task tree to appear with "Add a Task" button
    const addTaskButton = page.getByRole('button', { name: 'Add a Task' });
    await expect(addTaskButton).toBeVisible({ timeout: 10000 });
    await addTaskButton.click();

    // Fill in the task edit dialog
    const taskDialog = page.getByRole('dialog', { name: /Task/i });
    await expect(taskDialog).toBeVisible({ timeout: 5000 });

    await taskDialog.getByLabel('Name').fill('Power On VM');
    await taskDialog.getByLabel('Description').fill('Task to power on a virtual machine');

    await taskDialog.getByRole('button', { name: 'Save' }).click();

    // Verify the task appears in the task tree
    await expect(page.getByText('Power On VM').first()).toBeVisible({ timeout: 10000 });
  });
});
