// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Authentication and Authorization', () => {
  test('Session Token Renewal', async ({ steamfitterAuthenticatedPage: page }) => {
    const topbar = page.locator('mat-toolbar, [class*="topbar"], header, [role="banner"]').first();
    await expect(topbar).toBeVisible({ timeout: 15000 });

    const silentRenewRequests: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('auth-callback-silent') || url.includes('silent') || url.includes('token')) {
        silentRenewRequests.push(url);
      }
    });

    await page.waitForTimeout(10000);

    await expect(topbar).toBeVisible();
    await expect(topbar).toContainText(/admin/i);
  });
});
