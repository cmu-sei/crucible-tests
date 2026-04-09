// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('MSEL Info Pages Management', () => {
  test('Edit MSEL Page', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to the build page and open a MSEL with existing pages
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('networkidle');

    const mselLink = page.getByRole('link', { name: /Project Lagoon TTX/ }).first();
    await expect(mselLink).toBeVisible({ timeout: 10000 });
    await mselLink.click();
    await expect(page).toHaveURL(/.*\/build\?msel=.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // 1. Click an existing page tab (e.g., "New Page") — use first() since multiple may exist
    const pageTab = page.getByRole('tab', { name: 'New Page', exact: true }).first();
    await expect(pageTab).toBeVisible({ timeout: 5000 });
    await pageTab.click();
    await page.waitForLoadState('networkidle');

    // 2. Click the edit button for the page
    const editButton = page.getByRole('button', { name: 'Edit Page' });
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();

    // expect: Rich text editor appears with editing toolbar (Bold button visible)
    const boldButton = page.getByRole('button', { name: 'Bold' });
    await expect(boldButton).toBeVisible({ timeout: 5000 });

    // expect: Content area is editable
    const contentArea = page.locator('[contenteditable="true"], [placeholder="Content"]').first();
    await expect(contentArea).toBeVisible({ timeout: 5000 });

    // expect: Save and Cancel buttons are displayed (icon buttons at top)
    const saveButton = page.getByRole('button', { name: /Save/ }).first();
    await expect(saveButton).toBeVisible({ timeout: 5000 });

    const cancelButton = page.getByRole('button', { name: /Cancel/ }).first();
    await expect(cancelButton).toBeVisible({ timeout: 5000 });
  });
});
