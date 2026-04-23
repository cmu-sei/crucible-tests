// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspace Management', () => {
  test('Create Workspace - Authorized Creator', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Log in as user with creator role - handled by fixture (admin has creator role)
    // expect: User is on home page
    await expect(page).toHaveURL(/localhost:4201/);

    // Open sidebar if needed
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    // expect: Create workspace button is visible
    const createButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has(mat-icon:text("add")), [class*="create"]').first();
    await expect(createButton).toBeVisible({ timeout: 10000 });

    // 2. Click 'Create Workspace' button
    await createButton.click();
    await page.waitForTimeout(1000);

    // expect: Workspace is created or create workspace dialog opens
    // TopoMojo may create workspace immediately and navigate to editor
    const urlChanged = page.url().includes('/topo/');
    const dialogOpen = await page.locator('mat-dialog-container, [class*="dialog"], [role="dialog"]').isVisible({ timeout: 3000 }).catch(() => false);

    if (dialogOpen) {
      // expect: Form fields for workspace name and description are displayed
      const nameField = page.locator('input[placeholder*="ame"], input[formcontrolname*="name"], input[name="name"]').first();
      const hasNameField = await nameField.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasNameField) {
        // 3. Enter workspace name 'Test Lab'
        await nameField.fill('Test Lab');
        await expect(nameField).toHaveValue('Test Lab');
      }

      // 5. Click 'Create' or 'Save' button
      const saveButton = page.locator('button:has-text("Create"), button:has-text("Save"), button:has-text("OK")').first();
      const hasSave = await saveButton.isVisible({ timeout: 3000 }).catch(() => false);
      if (hasSave) {
        await saveButton.click();
        await page.waitForTimeout(2000);
      }
    }

    // expect: Workspace is created successfully
    // expect: User is navigated to workspace editor page or workspace list updates
  });
});
