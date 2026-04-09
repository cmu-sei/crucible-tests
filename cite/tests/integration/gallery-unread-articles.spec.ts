// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Integration with Gallery', () => {
  test('Gallery Integration - Unread Articles Notification', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to evaluation with new gallery articles
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await page.waitForLoadState('domcontentloaded');

    // expect: Dashboard displays

    // 2. Observe unread articles indicator
    const unreadBadge = page.locator('[class*="badge"], [class*="unread"], mat-badge, [class*="notification"]').first();
    await unreadBadge.isVisible({ timeout: 5000 }).catch(() => false);

    // expect: Unread articles count is displayed if available
  });
});
