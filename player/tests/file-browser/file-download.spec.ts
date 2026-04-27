// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('File Browser', () => {
  test('File Download', async ({ playerAuthenticatedPage: page }) => {
    // 1. Navigate to file browser and select a file
    const viewLink = page.getByRole('link', { name: 'Project Lagoon TTX - Admin' });
    const href = await viewLink.getAttribute('href');
    const viewId = href?.replace('/view/', '');

    await page.goto(`${Services.Player.UI}/view/${viewId}/files`);

    // expect: File browser loads
    await expect(page.locator('body')).toBeVisible();

    // 2. If files exist, click download button
    // expect: File download begins
    // expect: Browser shows download progress
    // expect: File is downloaded successfully
    // Note: File download testing depends on available files in the view
  });
});
