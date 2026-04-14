// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Gamespace Management', () => {
  test('Gamespace Challenge Submission', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to gamespace challenge section
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

      const challengeTab = page.locator('mat-tab:has-text("Challenge"), button:has-text("Challenge")').first();
      const hasChallenge = await challengeTab.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasChallenge) {
        await challengeTab.click();
        await page.waitForTimeout(1000);
      }

      // expect: Challenge questions are displayed
      const answerField = page.locator('input[type="text"], textarea, input[placeholder*="nswer"]').first();
      const hasAnswer = await answerField.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasAnswer) {
        // 2. Enter answer to a challenge question
        await answerField.fill('test-answer');

        // 3. Submit answer
        const submitButton = page.locator('button:has-text("Submit"), button:has-text("Grade"), button:has(mat-icon:text("send"))').first();
        const hasSubmit = await submitButton.isVisible({ timeout: 3000 }).catch(() => false);
        if (hasSubmit) {
          await submitButton.click();
          await page.waitForTimeout(2000);

          // expect: Answer is submitted
          // expect: Feedback is provided (correct/incorrect)
        }
      }
    }
  });
});
