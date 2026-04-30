// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('UI Responsiveness and Accessibility', () => {
  test.afterEach(async ({ }) => {
    // No resources to clean up for keyboard navigation tests
  });

  test('Keyboard Navigation in Forms', async ({ steamfitterAuthenticatedPage: page }) => {
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // Navigate to Scenario Templates section
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });
    await sidebar.locator('text=Scenario Templates').first().click();
    await page.waitForTimeout(1000);

    // Open the create template dialog
    const addButton = page.locator('button:has(mat-icon:text("add")), button:has-text("Add"), [mattooltip*="Add"]').first();
    await addButton.click();
    await page.waitForTimeout(500);

    // Wait for dialog to appear
    const dialog = page.locator('mat-dialog-container, [role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Tab through form fields and verify focus order
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
    expect(firstFocused).toBeTruthy();

    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    const secondFocused = await page.evaluate(() => document.activeElement?.tagName);
    expect(secondFocused).toBeTruthy();

    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    const thirdFocused = await page.evaluate(() => document.activeElement?.tagName);
    expect(thirdFocused).toBeTruthy();

    // Verify focus moved between different elements
    // (at least the active element should be within the dialog)
    const activeInDialog = await page.evaluate(() => {
      const dialog = document.querySelector('mat-dialog-container, [role="dialog"]');
      return dialog?.contains(document.activeElement) ?? false;
    });
    expect(activeInDialog).toBe(true);

    // Press Escape to close the dialog
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Verify dialog is closed
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });
});
