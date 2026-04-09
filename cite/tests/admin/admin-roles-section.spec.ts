// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Roles', () => {
  test('Roles Section', async ({ citeAuthenticatedPage: page }) => {

    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const rolesLink = page.locator('text=Roles, a:has-text("Roles"), mat-list-item:has-text("Roles")').first();
    await expect(rolesLink).toBeVisible({ timeout: 10000 });
    await rolesLink.click();
    await page.waitForLoadState('domcontentloaded');

    // expect: Tabs for Roles, Scoring Model Roles, and Evaluation Roles are visible
    const rolesTab = page.locator('[role="tab"]:has-text("Roles"), mat-tab:has-text("Roles")').first();
    await expect(rolesTab).toBeVisible({ timeout: 10000 });
  });
});
