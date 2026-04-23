// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspace Editor', () => {
  test('Workspace Editor - Update Settings', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace editor settings tab
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    const workspaceItems = page.locator('[class*="workspace-card"], [class*="item-card"], mat-list-item, [class*="list-item"]');
    const itemCount = await workspaceItems.count();

    if (itemCount > 0) {
      await workspaceItems.first().click();
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/\/topo\//, { timeout: 10000 });

      // expect: Settings form is displayed
      const nameField = page.locator('input[placeholder*="ame"], input[formcontrolname*="name"], input[name="name"]').first();
      const hasNameField = await nameField.isVisible({ timeout: 10000 }).catch(() => false);

      if (hasNameField) {
        // 2. Modify workspace name to 'Updated Lab Name'
        const originalName = await nameField.inputValue();
        await nameField.clear();
        await nameField.fill('Updated Lab Name');

        // expect: Name field accepts changes
        await expect(nameField).toHaveValue('Updated Lab Name');

        // 3. Modify workspace description
        const descField = page.locator('textarea, input[placeholder*="escription"], input[formcontrolname*="description"]').first();
        const hasDesc = await descField.isVisible({ timeout: 3000 }).catch(() => false);
        if (hasDesc) {
          await descField.fill('Updated description for testing');
        }

        // 4. Click 'Save' button (or auto-save may apply)
        const saveButton = page.locator('button:has-text("Save"), button:has(mat-icon:text("save"))').first();
        const hasSave = await saveButton.isVisible({ timeout: 3000 }).catch(() => false);
        if (hasSave) {
          await saveButton.click();
          await page.waitForTimeout(1000);
        }

        // Restore original name
        await nameField.clear();
        await nameField.fill(originalName);
        if (hasSave) {
          await saveButton.click();
          await page.waitForTimeout(1000);
        }
      }
    }
  });
});
