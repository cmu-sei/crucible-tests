// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, CASTER_THEMES, setCasterTheme } from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Global Workspace Settings`, () => {
    test('Paginate Active Runs', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      await page.goto(Services.Caster.UI + '/admin?section=Workspaces');

      const paginator = page.locator('mat-paginator');
      const itemsPerPage = paginator.getByRole('combobox', { name: 'Items per page:' });
      await expect(itemsPerPage).toBeVisible({ timeout: 10000 });
      await expect(itemsPerPage).toHaveText('20');
      // expect: the paginator shows the current range
      await expect(paginator.getByRole('status')).toBeVisible();

      // Use force:true because Angular Material's mat-mdc-paginator-touch-target overlay intercepts pointer events
      await itemsPerPage.click({ force: true });
      await expect(page.getByRole('option', { name: '50' })).toBeVisible();
      await page.keyboard.press('Escape');

      await expect(paginator.getByRole('button', { name: 'Previous page' })).toBeVisible();
      await expect(paginator.getByRole('button', { name: 'Next page' })).toBeVisible();
    });
  });
}
