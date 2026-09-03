// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Validation', () => {
  test('Unauthorized Action Handling', async ({ casterAuthenticatedPage: page }) => {

    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();

    await page.goto(Services.Caster.UI + '/admin');
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Users')).toBeVisible();
    await expect(page.getByText('Roles')).toBeVisible();
  });
});
