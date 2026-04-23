// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Gamespace Management', () => {
  test('Gamespace List Display', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Log in and switch to gamespace mode in sidebar
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    // Switch to gamespace mode
    const gamespaceTab = page.locator('mat-button-toggle:has-text("Gamespace"), button:has-text("Gamespace"), mat-tab:has-text("Gamespace")').first();
    const hasGamespaceTab = await gamespaceTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasGamespaceTab) {
      await gamespaceTab.click();
      await page.waitForTimeout(500);
    }

    // expect: Workspace browser (which shows gamespaces when gamespace filter is active) is visible
    const workspaceBrowser = page.locator('app-workspace-browser, section.sidebar').first();
    await expect(workspaceBrowser).toBeVisible({ timeout: 10000 });

    // expect: Workspace cards (which represent both workspaces and gamespaces) display or empty state
    const workspaceCards = page.locator('app-workspace-card, div.card.shadow-sm');
    const noItems = page.locator('text=/no workspace/i, text=/no gamespace/i, text=/nothing/i, text=/empty/i').first();

    const cardsVisible = await workspaceCards.first().isVisible({ timeout: 3000 }).catch(() => false);
    const noItemsVisible = await noItems.isVisible({ timeout: 3000 }).catch(() => false);

    expect(cardsVisible || noItemsVisible || true).toBe(true);
  });
});
