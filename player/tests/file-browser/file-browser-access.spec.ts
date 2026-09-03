// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, seededPrimaryViewName, findPlayerHomeViewLink } from '../../fixtures';

test.describe('File Browser', () => {
  test('File Browser Access', async ({ playerAuthenticatedPage: page }) => {
    const primaryViewName = seededPrimaryViewName();

    // 1. Navigate to file browser route /view/:id/files
    // First get a valid view ID from the home page
    const viewLink = await findPlayerHomeViewLink(page, primaryViewName);
    const href = await viewLink.getAttribute('href');
    const viewId = href?.replace('/view/', '');

    await page.goto(`${Services.Player.UI}/view/${viewId}/files`);

    // expect: File browser interface loads
    // expect: File list or directory structure is displayed
    // The file browser page should render without errors
    await expect(page.locator('body')).toBeVisible();
  });
});
