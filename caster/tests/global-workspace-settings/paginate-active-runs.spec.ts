// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Global Workspace Settings', () => {
  test('Paginate Active Runs', async ({ casterAuthenticatedPage: page }) => {

    await page.goto(Services.Caster.UI + '/admin?section=Workspaces');
    await expect(page.getByRole('heading', { name: 'Active Runs' })).toBeVisible({ timeout: 10000 });

    const itemsPerPage = page.getByRole('combobox', { name: 'Items per page:' });
    await expect(itemsPerPage).toBeVisible();
    await expect(page.getByRole('status')).toBeVisible();

    // Use force:true because Angular Material's mat-mdc-paginator-touch-target overlay intercepts pointer events
    await itemsPerPage.click({ force: true });
    await page.keyboard.press('Escape');

    await expect(page.getByRole('button', { name: 'Previous page' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next page' })).toBeVisible();
  });
});
