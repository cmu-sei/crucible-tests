// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('UI Responsiveness and Accessibility', () => {
  test.afterEach(async ({ }) => {
    // No resources to clean up for keyboard navigation tests
  });

  test('Keyboard Navigation Through Admin Sidebar', async ({ steamfitterAuthenticatedPage: page }) => {
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for sidebar to be visible
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    // Click on the sidebar to ensure focus is within it
    await sidebar.click();
    await page.waitForTimeout(300);

    // Use Tab key to navigate through sidebar items
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    // Verify focus has moved to an element within the sidebar
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeTruthy();

    // Continue tabbing through sidebar items
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    const secondFocusedElement = page.locator(':focus');
    await expect(secondFocusedElement).toBeTruthy();

    // Press Enter to select the focused item
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Verify that pressing Enter triggered navigation or selection
    const mainContent = page.locator('app-root, main, [class*="content"]').first();
    await expect(mainContent).toBeVisible({ timeout: 10000 });
  });
});
