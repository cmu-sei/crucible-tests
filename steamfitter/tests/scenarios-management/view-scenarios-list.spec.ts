// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Scenarios Management', () => {
  test('View Scenarios List', async ({ steamfitterAuthenticatedPage: page }) => {
    await page.goto(`${Services.Steamfitter.UI}/admin`);

    await page.locator('mat-list').getByText('Scenarios', { exact: true }).click();

    await expect(page.locator('text=Scenarios').first()).toBeVisible();
    await expect(page.locator('[class*="scenario"]').or(page.locator('table')).first()).toBeVisible();
  });
});
