// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, PLAYER_THEMES, setPlayerTheme } from '../../fixtures';
import { assertReadable, expectBodyTheme } from '../../../theme-helpers';

// One run per theme, each measuring that theme's colors. This used to view the
// page in light, flip to dark, and flip back, checking only that things were
// still visible; now each run applies its theme up front and measures real WCAG
// 1.4.3 contrast on the home page's always-present text. The deeper per-theme
// checks (direction, icon contrast, the colors design-spec contract) live in
// theme-contrast-compliance.spec.ts.
for (const theme of PLAYER_THEMES) {
  test.describe(`${theme} theme › Responsive Design and Accessibility`, () => {
    test('Color Contrast', async ({ playerAuthenticatedPage: page }) => {
      // 1. Log in and view the application in this run's theme
      await expect(page.getByText('My Views')).toBeVisible();
      await setPlayerTheme(page, theme);
      await expectBodyTheme(page, theme);

      // Key elements are visible in this theme
      await expect(page.getByText('Player')).toBeVisible();
      await expect(page.getByText('Admin User', { exact: true })).toBeVisible();
      await expect(page.getByRole('table')).toBeVisible();

      // expect: Text and background colors meet WCAG contrast requirements
      // expect: All text is readable
      await assertReadable(page.locator('.views-title'), `${theme}: My Views title`);
      const columnHeader = page.getByRole('columnheader').filter({ hasText: /\w/ }).first();
      await expect(columnHeader).toBeVisible();
      await assertReadable(columnHeader, `${theme}: table column header`);

      // expect: Interactive elements are visually distinguishable
      const toolbar = page.locator('app-topbar mat-toolbar.toolbar');
      await expect(toolbar).toBeVisible();
      await assertReadable(toolbar.locator('.view-text'), `${theme}: top bar title`);
      await assertReadable(
        toolbar.getByRole('button', { name: 'Menu', exact: true }),
        `${theme}: top bar user menu`
      );
    });
  });
}
