// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, CASTER_THEMES, setCasterTheme } from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Global Workspace Settings`, () => {
    test('View Active Runs Globally', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      await page.goto(Services.Caster.UI + '/admin?section=Workspaces');

      // expect: the table lists runs by Workspace and Project, with who started them and when
      for (const column of ['Workspace', 'Project', 'Type', 'Status', 'Started By', 'Started']) {
        await expect(page.getByRole('columnheader', { name: column, exact: true })).toBeVisible({ timeout: 10000 });
      }

      // expect: the toolbar has Search and the paginator
      await expect(page.getByRole('textbox', { name: 'Search' })).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'Items per page:' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Previous page' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Next page' })).toBeVisible();
    });
  });
}
