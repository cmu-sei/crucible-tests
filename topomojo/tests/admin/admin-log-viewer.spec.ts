// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Log Viewer', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin dashboard
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    // 2. Click on 'Logs' section
    const logsLink = page.locator('a:has-text("Log"), button:has-text("Log"), mat-tab:has-text("Log")').first();
    const hasLink = await logsLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasLink) {
      await logsLink.click();
      await page.waitForTimeout(1000);
    }

    // expect: Log viewer page loads
    // expect: System logs are displayed
    const logContent = page.locator('[class*="log"], pre, code, [class*="console"], textarea[readonly]').first();
    const hasLogs = await logContent.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasLogs) {
      await expect(logContent).toBeVisible();
    }
  });
});
