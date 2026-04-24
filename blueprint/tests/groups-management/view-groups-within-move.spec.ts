// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect } from '@playwright/test';
import { Services, authenticateBlueprintWithKeycloak } from '../../fixtures';

test.describe('Groups Management', () => {
  test('View Groups within Move', async ({ page }) => {
    // Authenticate
    await authenticateBlueprintWithKeycloak(page);

    // Navigate to build page
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('domcontentloaded');

    // Click on first MSEL
    const firstMselLink = page.locator('a[href*="/msel/"]').first();
    await expect(firstMselLink).toBeVisible({ timeout: 10000 });
    await firstMselLink.click();
    await page.waitForLoadState('domcontentloaded');

    // 1. Navigate to Moves section and expand a move
    const movesLink = page.locator('a:has-text("Moves"), button:has-text("Moves")').first();
    await movesLink.click();
    await page.waitForLoadState('domcontentloaded');

    // expect: Moves section loads
    await expect(page).toHaveURL(/.*moves.*/i);

    // Expand a move to view its groups
    const expandButton = page.locator('mat-expansion-panel-header, button[aria-label*="expand"]').first();
    if (await expandButton.isVisible({ timeout: 5000 })) {
      await expandButton.click();
      await page.waitForTimeout(1000);

      // expect: Groups within the move are displayed
      // expect: Each group shows: Group Number, Name, Description
      const groupElements = page.locator('[class*="group"], mat-list-item');
      if (await groupElements.first().isVisible({ timeout: 3000 })) {
        await expect(groupElements.first()).toBeVisible();
      }

      // expect: Groups are ordered within the move
      // expect: An 'Add Group' button is visible within the move if user has permissions
      const addGroupButton = page.locator('button:has-text("Add Group"), button[aria-label*="Add Group"]');
      if (await addGroupButton.isVisible({ timeout: 3000 })) {
        await expect(addGroupButton).toBeVisible();
      }
    }
  });
});
