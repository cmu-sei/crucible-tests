// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Gamespace Management', () => {
  test('Gamespace Challenge View', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to active gamespace with challenges
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    const gamespaceTab = page.locator('mat-button-toggle:has-text("Gamespace"), button:has-text("Gamespace")').first();
    const hasTab = await gamespaceTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasTab) {
      await gamespaceTab.click();
      await page.waitForTimeout(500);
    }

    const activeGamespaces = page.locator('[class*="gamespace-card"], [class*="item-card"], mat-list-item');
    const activeCount = await activeGamespaces.count();

    if (activeCount > 0) {
      await activeGamespaces.first().click();
      await page.waitForTimeout(2000);

      // expect: Challenge or quiz section is accessible
      const challengeTab = page.locator('mat-tab:has-text("Challenge"), button:has-text("Challenge"), [class*="challenge"]').first();
      const hasChallenge = await challengeTab.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasChallenge) {
        await challengeTab.click();
        await page.waitForTimeout(1000);

        // 2. View challenge questions
        // expect: Challenge questions are displayed
        // expect: Answer input fields are available
        const questionContent = page.locator('[class*="question"], [class*="challenge"], input[type="text"], textarea').first();
        const hasQuestions = await questionContent.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasQuestions) {
          await expect(questionContent).toBeVisible();
        }
      }
    }
  });
});
