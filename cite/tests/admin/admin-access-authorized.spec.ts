// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Evaluations', () => {
  test('Admin Page Access - Authorized', async ({ citeAuthenticatedPage: page }) => {

    // 1. Log in as user with ViewEvaluations or system admin permission
    // expect: User is authenticated with admin permissions

    // 2. Navigate to /admin route
    await page.goto(`${Services.Cite.UI}/admin`);

    // expect: Admin page loads
    // expect: Administration title displays
    const adminTitle = page.locator('h2:has-text("Administration")');
    await expect(adminTitle).toBeVisible({ timeout: 30000 });

    // expect: Admin navigation is visible with sections
    const evaluationsNav = page.locator('text=Evaluations').first();
    await expect(evaluationsNav).toBeVisible({ timeout: 10000 });
  });
});
