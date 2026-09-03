// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Roles and Permissions Management', () => {
  test('View Project Roles Tab', async ({ casterAuthenticatedPage: page }) => {

    // 1. Navigate to Roles admin section
    await page.goto(Services.Caster.UI + '/admin?section=Roles');

    // expect: Roles page loads with two tabs
    await expect(page.getByRole('tab', { name: 'Roles', exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: 'Project Roles' })).toBeVisible();

    // 2. Click on the Project Roles tab
    await page.getByRole('tab', { name: 'Project Roles' }).click();

    // expect: Project Roles tab is displayed
    await expect(page.getByRole('tab', { name: 'Project Roles', selected: true })).toBeVisible();

    // expect: Project-specific roles interface is shown
    await expect(page.getByRole('tabpanel')).toBeVisible();
  });
});
