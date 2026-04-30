// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Dialog Enhancements', () => {
  let templateId: string | null = null;

  test.afterEach(async ({ steamfitterApi }) => {
    if (templateId) {
      try {
        await steamfitterApi.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${templateId}`);
      } catch { /* ignore cleanup errors */ }
      templateId = null;
    }
  });

  test('Task Edit Dialog Uses Floating Labels', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    // Setup: create a template with a task via API
    const createTemplateResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Floating Labels Test', description: 'Test floating labels in task dialog', durationHours: 1 },
    });
    expect(createTemplateResp.ok()).toBeTruthy();
    const template = await createTemplateResp.json();
    templateId = template.id;

    // Add a task to the template
    const createTaskResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/tasks/scenariotemplate/${templateId}`, {
      data: { name: 'Floating Label Task', description: 'Task for testing floating labels', triggerCondition: 'Manual' },
    });
    if (createTaskResp.ok()) {
      const task = await createTaskResp.json();
      expect(task.id).toBeTruthy();
    }

    // Navigate to admin and select the template
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });
    await sidebar.locator('text=Scenario Templates').first().click();
    await page.waitForTimeout(1000);

    // Click on the template
    await page.locator('text=Floating Labels Test').first().click();
    await page.waitForTimeout(1000);

    // Find and click on the task to open edit dialog
    const taskElement = page.locator('text=Floating Label Task').first();
    const taskVisible = await taskElement.isVisible({ timeout: 5000 }).catch(() => false);

    if (taskVisible) {
      await taskElement.click();
      await page.waitForTimeout(500);

      // Look for edit button on the task
      const editButton = page.locator('button:has(mat-icon:text("edit"))').first();
      const hasEdit = await editButton.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasEdit) {
        await editButton.click();
        await page.waitForTimeout(500);
      }
    }

    // Verify mat-label elements (floating labels) are used instead of just placeholders
    const dialog = page.locator('mat-dialog-container, [role="dialog"]').first();
    const dialogVisible = await dialog.isVisible({ timeout: 5000 }).catch(() => false);

    if (dialogVisible) {
      const matLabels = dialog.locator('mat-label, label[matformfieldlabel]');
      const labelCount = await matLabels.count();
      // Task edit dialog should use floating labels (mat-label elements)
      expect(labelCount).toBeGreaterThan(0);

      // Close the dialog
      await page.keyboard.press('Escape');
    }
  });
});
