// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, CASTER_THEMES, setCasterTheme } from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Global Workspace Settings`, () => {
    test('Sort Active Runs', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      await page.goto(Services.Caster.UI + '/admin?section=Workspaces');

      const started = page.getByRole('columnheader', { name: 'Started', exact: true });
      const status = page.getByRole('columnheader', { name: 'Status', exact: true });
      await expect(started).toBeVisible({ timeout: 10000 });

      // 2-3. Sort by Started, then reverse it
      await started.getByRole('button').click();
      await expect(started).toHaveAttribute('aria-sort', 'ascending');
      await started.getByRole('button').click();
      await expect(started).toHaveAttribute('aria-sort', 'descending');

      // 4. Sort by Status
      await status.getByRole('button').click();
      await expect(status).toHaveAttribute('aria-sort', 'ascending');
      await expect(started).toHaveAttribute('aria-sort', 'none');
    });
  });
}
