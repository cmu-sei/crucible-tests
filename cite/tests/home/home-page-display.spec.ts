// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Home Page and Evaluation List', () => {
  test('Home Page Display', async ({ citeAuthenticatedPage: page }) => {

    // 1. Log in and land on home page
    // expect: Home page displays with 'CITE' icon and 'My Evaluations' title
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });

    // expect: CITE branding is visible
    const citeIcon = page.locator('img[src*="cite"], [class*="cite-logo"], mat-toolbar img, mat-toolbar [class*="icon"]').first();
    await expect(citeIcon).toBeVisible({ timeout: 10000 });

    // expect: Evaluation list component is visible
    const evaluationList = page.locator('mat-table, table, [class*="evaluation"], [class*="list"]').first();
    await expect(evaluationList).toBeVisible({ timeout: 10000 });

    // expect: Navigation elements are present
    const toolbar = page.locator('mat-toolbar, [class*="topbar"]').first();
    await expect(toolbar).toBeVisible();

    // expect: Administration button is visible for authorized users
    const adminButton = page.locator('button:has-text("Administration"), a:has-text("Administration"), button:has-text("Admin"), a:has-text("Admin")').first();
    await expect(adminButton).toBeVisible({ timeout: 5000 });
  });
});
