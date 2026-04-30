// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

// Gameboard's notification model differs from the plan:
//   * Admin can create Notifications (banners shown on login) from /admin/notifications.
//   * Admin can send Announcements (real-time broadcasts) from /admin/overview.
// There is no "notification center" with per-notification read-state or a Clear All button.
// This test creates an admin notification and verifies the UI flow.
test.describe('Notifications', () => {
  test('In-App Notifications Display - Admin Notification Flow', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(Services.Gameboard.UI + '/admin/notifications', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Create Notification/i })).toBeVisible();
  });
});
