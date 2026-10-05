// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, PLAYER_THEMES, setPlayerTheme } from '../../fixtures';

for (const theme of PLAYER_THEMES) {
  test.describe(`${theme} theme › Administration - Roles and Permissions`, () => {
    test('Expand/Collapse Permission Groups', async ({ playerAuthenticatedPage: page }) => {
      await setPlayerTheme(page, theme);
      // 1. Log in as admin and navigate to Administration > Roles
      await page.getByRole('button', { name: 'Menu' }).click();
      await page.getByRole('menuitem', { name: 'Administration' }).click();
      await page.getByRole('button', { name: 'Roles Roles' }).click();

      // expect: The Roles tab displays the permissions matrix
      await expect(page.getByRole('tab', { name: 'Roles', selected: true })).toBeVisible();

      // 2. Click the expand button next to a permission group
      // Each permission row has an info/expand button (󰋼 icon), labelled "About <permission>".
      // The permission cell's accessible name includes that label, so key on the button.
      const expandButton = page.getByRole('button', { name: 'About All', exact: true });
      await expect(expandButton).toBeVisible();
      await expandButton.click();

      // expect: The permission group expands to show sub-permissions (if any)

      // 3. Click the collapse button
      await expandButton.click();

      // expect: The permission group collapses
    });
  });
}
