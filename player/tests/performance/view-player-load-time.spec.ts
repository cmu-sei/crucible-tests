// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Performance', () => {
  test('Page Load Performance - View Player', async ({ playerAuthenticatedPage: page }) => {
    // 1. Measure time from navigation to view player until page is interactive
    await expect(page.getByText('My Views')).toBeVisible();

    const startTime = Date.now();

    await page.getByRole('link', { name: 'Project Lagoon TTX - Admin' }).click();

    // expect: View player loads within acceptable time
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });
    await expect(page.getByText('Project Lagoon TTX - Admin User')).toBeVisible();

    const loadTime = Date.now() - startTime;

    // expect: Applications list renders promptly
    expect(loadTime).toBeLessThan(5000);
  });
});
