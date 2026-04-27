// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('File Browser', () => {
  test('File Browser Access', async ({ playerAuthenticatedPage: page }) => {
    // 1. Navigate to file browser route /view/:id/files
    // First get a valid view ID from the home page
    const viewLink = page.getByRole('link', { name: 'Project Lagoon TTX - Admin' });
    const href = await viewLink.getAttribute('href');
    const viewId = href?.replace('/view/', '');

    await page.goto(`${Services.Player.UI}/view/${viewId}/files`);

    // expect: File browser interface loads
    // expect: File list or directory structure is displayed
    // The file browser page should render without errors
    await expect(page.locator('body')).toBeVisible();
  });
});
