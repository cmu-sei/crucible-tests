// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

// Gameboard's profile page is at /user/profile and has three tabs
// (Profile, Certificates, History). The Profile tab shows display-name and
// sponsoring-organization sections.
test.describe('Profile', () => {
  test('View User Profile', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(Services.Gameboard.UI + '/user/profile', { waitUntil: 'domcontentloaded' });

    // Section headers on the Profile tab.
    await expect(page.getByRole('heading', { name: 'Your display name' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Your sponsoring organization' })).toBeVisible();

    // Requested Display Name input is always present (visible to all users).
    await expect(page.locator('input[name="requestedName"]')).toBeVisible();
  });
});
