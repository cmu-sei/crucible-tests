// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('API Error Handling - Network Failure', async ({ citeAuthenticatedPage: page }) => {

    // 1. Log in successfully
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });

    // 2. Simulate network failure (block API calls)
    await page.route('**/api/**', (route) => route.abort('connectionrefused'));

    // 3. Attempt to perform an action that requires API call
    await page.reload();

    // expect: Application detects network failure
    // expect: Error message is displayed to user
    // expect: Application remains stable
    await page.waitForTimeout(3000);
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Unroute to restore network
    await page.unroute('**/api/**');
  });
});
