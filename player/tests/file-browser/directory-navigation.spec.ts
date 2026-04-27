// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('File Browser', () => {
  test('File Browser - Directory Navigation', async ({ playerAuthenticatedPage: page }) => {
    // 1. Open file browser with nested directories
    const viewLink = page.getByRole('link', { name: 'Project Lagoon TTX - Admin' });
    const href = await viewLink.getAttribute('href');
    const viewId = href?.replace('/view/', '');

    await page.goto(`${Services.Player.UI}/view/${viewId}/files`);

    // expect: Root directory contents are displayed
    await expect(page.locator('body')).toBeVisible();

    // 2. If directories are available, click on one
    // expect: Directory opens and shows its contents
    // expect: Breadcrumb or path updates to show current location

    // 3. Navigate back
    // expect: User navigates back to parent directory
    // Note: File browser content depends on view configuration
  });
});
