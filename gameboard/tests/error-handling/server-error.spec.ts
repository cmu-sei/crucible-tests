// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling', () => {
  test('API Error Handling - Server Error (500)', async ({ gameboardAuthenticatedPage: page }) => {
    // Intercept a representative API endpoint and return 500.
    await page.route(Services.Gameboard.API + '/api/**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"synthetic"}' })
    );

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(Services.Gameboard.UI + '/admin/registrar/users', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    // App should still be navigable — Administration shell remains.
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 15000 });
    // No uncaught JS errors from the 500 response.
    expect(errors, `unexpected page errors: ${errors.join('; ')}`).toEqual([]);
  });
});
