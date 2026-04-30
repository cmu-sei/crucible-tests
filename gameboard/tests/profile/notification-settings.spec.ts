// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getAdminToken } from '../../api-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// Gameboard's user notification preference (play audio on browser notification)
// is persisted via PUT /api/user/settings. We exercise the round-trip: read
// current value, toggle it, verify persistence, then restore.
test.describe('Profile', () => {
  test('User Preferences - Notification Settings', async ({ gameboardAuthenticatedPage: page }) => {
    const token = await getAdminToken();
    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    let original: boolean | undefined;
    try {
      const getRes = await ctx.fetch('http://localhost:5002/api/user/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(getRes.ok()).toBe(true);
      const current = await getRes.json();
      original = current.playAudioOnBrowserNotification;

      // Toggle to the opposite value.
      const putRes = await ctx.fetch('http://localhost:5002/api/user/settings', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { playAudioOnBrowserNotification: !original },
      });
      expect(putRes.ok()).toBe(true);

      const verifyRes = await ctx.fetch('http://localhost:5002/api/user/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const updated = await verifyRes.json();
      expect(updated.playAudioOnBrowserNotification).toBe(!original);
    } finally {
      // Restore original value.
      if (original !== undefined) {
        await ctx.fetch('http://localhost:5002/api/user/settings', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          data: { playAudioOnBrowserNotification: original },
        }).catch(() => {});
      }
      await ctx.dispose();
    }

    // UI sanity — admin navigation still works.
    await page.goto(Services.Gameboard.UI + '/admin/support/settings', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Support Settings' })).toBeVisible();
  });
});
