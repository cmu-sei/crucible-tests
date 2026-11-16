// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, CASTER_THEMES, setCasterTheme } from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Global Workspace Settings`, () => {
    test('View Global Workspace Settings', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      await page.goto(Services.Caster.UI + '/admin?section=Workspaces');

      // expect: the toolbar ends with the Disable Workspace Operations switch
      await expect(page.getByRole('switch', { name: 'Disable Workspace Operations' })).toBeVisible({ timeout: 10000 });

      // expect: the active runs table is below the toolbar
      await expect(page.getByRole('textbox', { name: 'Search' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Workspace', exact: true })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Status', exact: true })).toBeVisible();
    });
  });
}
