// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Global Workspace Settings', () => {
  test('View Active Runs Globally', async ({ casterAuthenticatedPage: page }) => {

    await page.goto(Services.Caster.UI + '/admin?section=Workspaces');
    await expect(page.getByRole('heading', { name: 'Active Runs' })).toBeVisible({ timeout: 10000 });

    await expect(page.getByRole('button', { name: 'Created At' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Destroy' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'status' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Workspace ID' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Actions' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Items per page:' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous page' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next page' })).toBeVisible();
  });
});
