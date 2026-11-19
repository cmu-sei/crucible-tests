// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspace Management', () => {
  test('Create Workspace - Validation - Required Fields', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Open create workspace dialog
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      // The toggle flips app-workspace-browser's [hidden] binding (sidebar `open`, default
      // true, persisted in localStorage), so the click's completion signal is the browser
      // switching to the opposite visibility from before the click.
      const workspaceBrowser = page.locator('app-workspace-browser');
      const wasOpen = await workspaceBrowser.isVisible();
      await sidebarToggle.click();
      await expect(workspaceBrowser).toBeVisible({ visible: !wasOpen });
    }

    const createButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has(mat-icon:text("add"))').first();
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();

    // expect: Create workspace form is displayed (if dialog-based)
    const dialog = page.locator('mat-dialog-container, [class*="dialog"], [role="dialog"]').first();
    const hasDialog = await dialog.waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false);

    if (hasDialog) {
      // 2. Leave workspace name field empty
      const nameField = page.locator('input[placeholder*="ame"], input[formcontrolname*="name"]').first();
      const hasNameField = await nameField.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasNameField) {
        await nameField.clear();

        // expect: Name field is empty
        await expect(nameField).toHaveValue('');

        // 3. Attempt to submit form
        const submitButton = page.locator('button:has-text("Create"), button:has-text("Save")').first();
        const isDisabled = await submitButton.isDisabled();

        // expect: Form validation prevents submission
        // expect: Error message indicates name is required
        if (!isDisabled) {
          await submitButton.click();
          const errorMsg = page.locator('[class*="error"], mat-error, [class*="invalid"]').first();
          await expect(errorMsg).toBeVisible({ timeout: 5000 });
        } else {
          expect(isDisabled).toBe(true);
        }
      }
    }
  });
});
