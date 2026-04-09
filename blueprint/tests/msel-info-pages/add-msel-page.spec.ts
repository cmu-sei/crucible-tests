// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('MSEL Info Pages Management', () => {
  test('Add MSEL Page', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to the build page and open a MSEL
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('networkidle');

    // Open an existing MSEL
    const mselLink = page.getByRole('link', { name: /Project Lagoon TTX/ }).first();
    await expect(mselLink).toBeVisible({ timeout: 10000 });
    await mselLink.click();
    await expect(page).toHaveURL(/.*\/build\?msel=.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // 1. Click the 'Add Page' tab (plus icon at end of tabs)
    const addPageTab = page.getByRole('tab', { name: 'Add Page' });
    await expect(addPageTab).toBeVisible({ timeout: 5000 });
    await addPageTab.click();
    await page.waitForLoadState('networkidle');

    // expect: A new page is created with a default name like 'New Page' or 'New Page N'
    // The new page tab should be selected (active)
    const selectedTab = page.getByRole('tab', { selected: true });
    await expect(selectedTab).toHaveText(/New Page/, { timeout: 5000 });

    // expect: The page name input is visible and editable
    const pageNameInput = page.getByRole('textbox').first();
    await expect(pageNameInput).toBeVisible({ timeout: 5000 });

    // expect: The rich text editor toolbar is displayed (with Bold, Italic, etc.)
    const boldButton = page.getByRole('button', { name: 'Bold' });
    await expect(boldButton).toBeVisible({ timeout: 5000 });

    // expect: The content area is visible for editing
    const contentArea = page.locator('[contenteditable="true"], [placeholder="Content"]').first();
    await expect(contentArea).toBeVisible({ timeout: 5000 });

    // 2. Verify save/cancel buttons are available
    const saveButton = page.locator('button:has(mat-icon)').first();
    await expect(saveButton).toBeVisible({ timeout: 5000 });
  });
});
