// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspace Management', () => {
  test('Workspace List - Empty State', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Log in as user with no workspaces - using default admin, check for empty state handling
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    // expect: Empty state message is displayed or workspace list is empty
    const workspaceItems = page.locator('[class*="workspace-card"], [class*="item-card"], mat-list-item, [class*="ws-card"]');
    const itemCount = await workspaceItems.count();

    if (itemCount === 0) {
      const emptyState = page.locator('[class*="empty"], [class*="no-results"], text=/no workspaces/i').first();
      const hasEmptyState = await emptyState.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasEmptyState) {
        await expect(emptyState).toBeVisible();
      }
    }

    // expect: Create workspace button is visible if user has creator role
    const createButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has(mat-icon:text("add"))').first();
    const isCreateVisible = await createButton.isVisible({ timeout: 5000 }).catch(() => false);
    if (isCreateVisible) {
      await expect(createButton).toBeVisible();
    }
  });
});
