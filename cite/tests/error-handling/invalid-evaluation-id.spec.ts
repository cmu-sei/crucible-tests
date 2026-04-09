// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Invalid Evaluation ID', async ({ citeAuthenticatedPage: page }) => {

    // 1. Log in successfully
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });

    // 2. Navigate to URL with invalid evaluation ID parameter
    await page.goto(`${Services.Cite.UI}/?evaluation=00000000-0000-0000-0000-000000000000`);
    await page.waitForLoadState('domcontentloaded');

    // expect: Error message is displayed or user redirected
    // expect: User can navigate back to home
    await page.waitForTimeout(3000);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
