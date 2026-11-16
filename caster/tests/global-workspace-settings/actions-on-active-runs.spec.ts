// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, CASTER_THEMES, setCasterTheme } from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Global Workspace Settings`, () => {
    test('Perform Actions on Active Runs', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      await page.goto(Services.Caster.UI + '/admin?section=Workspaces');

      await expect(page.getByRole('columnheader', { name: 'Workspace', exact: true })).toBeVisible({ timeout: 10000 });

      // expect: each run row has an Open action, enabled or disabled with a reason
      const runRows = page.locator('tr.element-row');
      const count = await runRows.count();
      for (let i = 0; i < count; i++) {
        await expect(runRows.nth(i).getByRole('cell').first().getByRole('link', { name: /^Open / })
          .or(runRows.nth(i).getByRole('button', { name: /^Open .* \(not available\)$/ }))).toBeVisible();
      }

      // expect: with no runs, the table says so
      if (count === 0) {
        await expect(page.getByRole('cell', { name: 'No runs are queued, planning or applying right now' })).toBeVisible();
      }
    });
  });
}
