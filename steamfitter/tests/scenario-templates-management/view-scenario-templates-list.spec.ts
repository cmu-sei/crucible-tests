// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Scenario Templates Management', () => {
  test('View Scenario Templates List', async ({ steamfitterAuthenticatedPage: page }) => {
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    const scenarioTemplatesItem = sidebar.locator('text=Scenario Templates').first();
    await scenarioTemplatesItem.click();
    await page.waitForTimeout(1000);

    const addButton = page.getByRole('button', { name: /Add Scenario Template/ });
    await expect(addButton).toBeVisible({ timeout: 10000 });
  });
});
