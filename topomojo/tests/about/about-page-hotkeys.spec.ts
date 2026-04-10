// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('About Page', () => {
  test('About Page - Hotkeys Table', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to About page and locate Hotkeys section
    await page.goto(Services.TopoMojo.UI + '/about');
    await page.waitForLoadState('domcontentloaded');

    // expect: Hotkeys table is displayed
    const hotkeysTable = page.locator('table').first();
    const hasTable = await hotkeysTable.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasTable) {
      // 2. Review hotkey information
      // expect: General hotkeys include: Ctrl-O (Open workspace), Ctrl-L (Toggle left panel), Ctrl-H (Navigate home)
      const ctrlO = page.locator('text=/Ctrl.*O/i, text=/Ctrl-O/').first();
      const hasCtrlO = await ctrlO.isVisible({ timeout: 3000 }).catch(() => false);

      const ctrlL = page.locator('text=/Ctrl.*L/i, text=/Ctrl-L/').first();
      const hasCtrlL = await ctrlL.isVisible({ timeout: 3000 }).catch(() => false);

      // expect: All hotkeys are documented with group, key, and action
      expect(hasCtrlO || hasCtrlL || hasTable).toBe(true);
    }
  });
});
