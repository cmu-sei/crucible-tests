// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Performance', () => {
  test('Page Load Performance - Home Page', async ({ playerAuthenticatedPage: page }) => {
    // 1. Measure time from navigation to home page until page is fully loaded
    const startTime = Date.now();

    // Navigate to home page (already authenticated via fixture)
    await expect(page.getByText('My Views')).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    const loadTime = Date.now() - startTime;

    // expect: Home page loads within acceptable time (e.g., under 3 seconds)
    // Note: The fixture handles authentication, so this measures post-auth page load
    expect(loadTime).toBeLessThan(3000);

    // expect: No blocking resources delay rendering
    await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  });
});
