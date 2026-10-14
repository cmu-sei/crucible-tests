// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, CASTER_THEMES, setCasterTheme } from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Modules Management`, () => {
    test('View Module Source Sync Failures', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      // One source syncing, one that has failed since its last good sync.
      await page.route('**/api/modules/sources', (route) =>
        route.fulfill({
          json: [
            {
              name: 'crucible-modules',
              provider: 'Git',
              lastAttempt: '2026-10-14T13:00:00Z',
              lastSuccess: '2026-10-14T13:00:00Z',
              error: null,
            },
            {
              name: 'broken-source',
              provider: 'Git',
              lastAttempt: '2026-10-14T13:00:00Z',
              lastSuccess: '2026-10-14T12:00:00Z',
              error: 'fatal: repository not found',
            },
          ],
        })
      );

      await page.goto(Services.Caster.UI + '/admin?section=Modules');

      // expect: one inline warning, for the failing source only, and no dialog
      const warning = page.getByRole('alert').filter({ hasText: 'failed to sync' });
      await expect(warning).toHaveCount(1, { timeout: 10000 });
      await expect(warning).toContainText('Module source broken-source failed to sync.');
      await expect(warning).toContainText('Showing its Modules from the last successful sync');
      await expect(warning).toContainText('fatal: repository not found');
      await expect(page.getByRole('dialog')).toHaveCount(0);

      // expect: the Modules are still listed
      await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    });

    test('View Modules With No Module Source', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      await page.route('**/api/modules/sources', (route) => route.fulfill({ json: [] }));

      await page.goto(Services.Caster.UI + '/admin?section=Modules');

      await expect(page.getByText('No module source is configured, so no Modules can be synced.')).toBeVisible({
        timeout: 10000,
      });
    });
  });
}
