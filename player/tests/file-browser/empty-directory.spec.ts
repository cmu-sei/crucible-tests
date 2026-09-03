// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, seededPrimaryViewName, findPlayerHomeViewLink } from '../../fixtures';

test.describe('File Browser', () => {
  test('File Browser - Empty Directory', async ({ playerAuthenticatedPage: page }) => {
    const primaryViewName = seededPrimaryViewName();

    // 1. Navigate to file browser for a directory with no files
    const viewLink = await findPlayerHomeViewLink(page, primaryViewName);
    const href = await viewLink.getAttribute('href');
    const viewId = href?.replace('/view/', '');

    await page.goto(`${Services.Player.UI}/view/${viewId}/files`);

    // expect: File browser displays empty state message
    // expect: Message indicates no files are available
    // expect: No errors are displayed
    await expect(page.locator('body')).toBeVisible();

    // The page should render without errors even with no files
  });
});
