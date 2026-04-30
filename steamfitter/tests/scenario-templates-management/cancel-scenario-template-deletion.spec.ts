// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Scenario Templates Management', () => {
  let templateId: string | null = null;

  test.afterEach(async ({ steamfitterApi }) => {
    if (templateId) {
      try {
        await steamfitterApi.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${templateId}`);
      } catch { /* ignore cleanup errors */ }
    }
  });

  test('Cancel Scenario Template Deletion', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    const createResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Cancel Delete Template', description: 'Template deletion to be cancelled', durationHours: 1 },
    });
    expect(createResp.ok()).toBeTruthy();
    const template = await createResp.json();
    templateId = template.id;

    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });
    await sidebar.locator('text=Scenario Templates').first().click();
    await page.waitForTimeout(1000);

    await expect(page.locator('text=Cancel Delete Template').first()).toBeVisible({ timeout: 10000 });

    const templateRow = page.locator('text=Cancel Delete Template').first();
    const menuButton = templateRow.locator('..').locator('button:has(mat-icon:text("more_vert")), [class*="menu"]').first();
    const hasMenu = await menuButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasMenu) {
      await menuButton.click();
      await page.waitForTimeout(300);
    }

    const deleteOption = page.locator('button:has-text("Delete"), [role="menuitem"]:has-text("Delete")').first();
    await deleteOption.click();
    await page.waitForTimeout(500);

    const confirmDialog = page.locator('mat-dialog-container, [role="dialog"]').first();
    const hasConfirm = await confirmDialog.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasConfirm) {
      const cancelButton = confirmDialog.locator('button:has-text("Cancel"), button:has-text("No")').first();
      await cancelButton.click();
      await page.waitForTimeout(500);
    }

    await expect(page.locator('text=Cancel Delete Template').first()).toBeVisible({ timeout: 5000 });
  });
});
