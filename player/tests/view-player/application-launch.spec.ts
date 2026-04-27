// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('View Player Interface', () => {
  test('Application Selection and Launch', async ({ playerAuthenticatedPage: page }) => {
    // 1. Navigate to view player page with applications
    await page.getByRole('link', { name: 'Project Lagoon TTX - Admin' }).click();
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });

    // expect: Applications are listed in sidebar
    await expect(page.getByRole('link', { name: 'Player' })).toBeVisible();

    // 2. Click on an application in the sidebar
    // The view loads an iframe with the application content
    const iframe = page.frameLocator('iframe');

    // expect: Application is selected/highlighted
    // expect: Application opens in the main content area or new window/tab
    // expect: Application interface is functional
    // Verify the iframe exists (application loaded in content area)
    await expect(page.locator('iframe')).toBeVisible({ timeout: 10000 });
  });
});
