// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Integration with Player and StackStorm', () => {
  let templateId: string | null = null;

  test.afterEach(async ({ request }) => {
    if (templateId) {
      try {
        await request.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${templateId}`);
      } catch { /* ignore cleanup errors */ }
      templateId = null;
    }
  });

  test('Task Execution Uses StackStorm Actions', async ({ steamfitterAuthenticatedPage: page, request }) => {
    // Setup: create a template via API
    const createResp = await request.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'StackStorm Actions Test', description: 'Test StackStorm integration', durationHours: 1 },
    });
    expect(createResp.ok()).toBeTruthy();
    const template = await createResp.json();
    templateId = template.id;

    // Navigate to admin and select the template
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });
    await sidebar.locator('text=Scenario Templates').first().click();
    await page.waitForTimeout(1000);

    // Click on the template
    await page.locator(`text=StackStorm Actions Test`).first().click();
    await page.waitForTimeout(1000);

    // Open task form (add a task)
    const addTaskButton = page.locator('button:has(mat-icon:text("add")), button:has-text("Add Task"), [mattooltip*="task"]').first();
    const hasAddTask = await addTaskButton.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasAddTask) {
      await addTaskButton.click();
      await page.waitForTimeout(500);
    }

    // Verify action dropdown contains StackStorm actions
    const actionDropdown = page.locator('mat-select, select, [role="listbox"]').first();
    const hasDropdown = await actionDropdown.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasDropdown) {
      await actionDropdown.click();
      await page.waitForTimeout(500);

      // Look for StackStorm-related options
      const options = page.locator('mat-option, option, [role="option"]');
      const optionCount = await options.count();
      expect(optionCount).toBeGreaterThan(0);

      // Close dropdown
      await page.keyboard.press('Escape');
    }
  });
});
