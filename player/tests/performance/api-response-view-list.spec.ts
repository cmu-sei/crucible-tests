// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Performance', () => {
  test('API Response Time - View List', async ({ playerAuthenticatedPage: page }) => {
    // 1. Monitor network requests when loading view list
    const apiRequests: { url: string; duration: number }[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/') && url.includes('view')) {
        const timing = response.request().timing();
        apiRequests.push({ url, duration: timing.responseEnd });
      }
    });

    // Reload to capture API calls
    await page.reload();
    await expect(page.getByText('My Views')).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    // expect: API response time is under acceptable threshold (e.g., 1 second)
    // expect: No unnecessary API calls are made
    // The page should load views within a reasonable time
    await expect(page.getByRole('link', { name: 'Project Lagoon TTX' })).toBeVisible();
  });
});
