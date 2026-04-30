// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Authentication and Authorization', () => {
  test('User Logout Flow', async ({ steamfitterAuthenticatedPage: page }) => {
    const topbar = page.locator('mat-toolbar, [class*="topbar"], header, [role="banner"]').first();
    await expect(topbar).toBeVisible({ timeout: 15000 });
    await expect(topbar).toContainText(/admin/i);

    const userMenu = page.locator('button:has-text("admin"), [class*="user-menu"], mat-icon:text("person"), button:has(mat-icon:text("account_circle"))').first();
    await userMenu.click();
    await page.waitForTimeout(500);

    const logoutOption = page.locator('button:has-text("Logout"), a:has-text("Logout"), [class*="logout"]').first();
    await expect(logoutOption).toBeVisible({ timeout: 5000 });
    await logoutOption.click();

    await page.waitForURL(
      (url) => url.toString().includes('/realms/crucible') || url.toString().includes(':8443'),
      { timeout: 30000 }
    );
  });
});
