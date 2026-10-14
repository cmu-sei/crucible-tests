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

    test('Update Modules From An Unknown Module ID', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      await page.goto(Services.Caster.UI + '/admin?section=Modules');
      await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible({ timeout: 10000 });

      // 1. Ask for a module source that is not configured
      await page.getByRole('textbox', { name: 'External Module ID' }).fill('no-such-source');
      await page.getByRole('button', { name: 'Add/Update the Modules from this source' }).click();

      // expect: the API's answer in a snack bar, not the error sheet
      await expect(page.locator('mat-snack-bar-container')).toContainText(
        "'no-such-source' does not name any configured module source."
      );
      // The error sheet opens a second after an error, so give it the chance.
      await page.waitForTimeout(1500);
      await expect(page.locator('mat-bottom-sheet-container')).toHaveCount(0);
    });

    test('Update Modules From A Module ID', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      // The sync itself answers with no body.
      await page.route('**/api/repository/modules', (route) => route.fulfill({ status: 200, body: '' }));

      await page.goto(Services.Caster.UI + '/admin?section=Modules');
      await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible({ timeout: 10000 });

      // 1. Update the Modules from a source
      await page.getByRole('textbox', { name: 'External Module ID' }).fill('crucible-modules');
      const reload = page.waitForRequest(
        (r) => r.method() === 'GET' && new URL(r.url()).pathname.endsWith('/api/modules')
      );
      await page.getByRole('button', { name: 'Add/Update the Modules from this source' }).click();

      // expect: the list reloads to show what was synced, and no error
      await reload;
      await page.waitForTimeout(1500);
      await expect(page.locator('mat-bottom-sheet-container')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Add/Update the Modules from this source' })).toBeEnabled();
    });

    test('Update Modules From A Module ID That Fails To Sync', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      // The source is configured, but syncing it fails.
      await page.route('**/api/repository/modules', (route) =>
        route.fulfill({
          status: 502,
          json: { title: 'Failed to sync Modules: fatal: repository not found', status: 502 },
        })
      );

      await page.goto(Services.Caster.UI + '/admin?section=Modules');
      await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible({ timeout: 10000 });

      // 1. Update the Modules from the source
      await page.getByRole('textbox', { name: 'External Module ID' }).fill('crucible-modules');
      await page.getByRole('button', { name: 'Add/Update the Modules from this source' }).click();

      // expect: why, in a snack bar, not the error sheet
      await expect(page.locator('mat-snack-bar-container')).toContainText(
        'Failed to sync Modules: fatal: repository not found'
      );
      await page.waitForTimeout(1500);
      await expect(page.locator('mat-bottom-sheet-container')).toHaveCount(0);
    });

    test('Update All Modules When A Source Fails To Sync', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

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

      // expect: opening the page shows the warning, but no snack bar
      await expect(page.getByRole('alert').filter({ hasText: 'failed to sync' })).toHaveCount(1, { timeout: 10000 });
      await expect(page.locator('mat-snack-bar-container')).toHaveCount(0);

      // 1. Update the Modules from every source
      await page.getByRole('button', { name: 'Add/Update the Modules from every source' }).click();

      // expect: the failing source, and only it, in a snack bar
      const snackBar = page.locator('mat-snack-bar-container');
      await expect(snackBar).toHaveText(/Module source broken-source failed to sync/);
      await expect(snackBar).not.toContainText('crucible-modules');
      await expect(page.locator('mat-bottom-sheet-container')).toHaveCount(0);
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
