// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, setCasterTheme, CASTER_THEMES } from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Home Page and Navigation`, () => {
    test('Navigation to Admin Section', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

    // 1. Log in as admin user
    // expect: Successfully authenticated on home page
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();

    // 2. Navigate to http://localhost:4310/admin
    await page.goto(Services.Caster.UI + '/admin');

    // expect: The admin interface loads
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 10000 });

    // expect: A sidebar navigation menu is visible
    // expect: The sidebar contains sections: Users, Projects, VLANs, Roles, Groups, Workspaces, Modules
    await expect(page.getByText('Projects').first()).toBeVisible();
    await expect(page.getByText('Workspaces')).toBeVisible();
    await expect(page.getByText('VLANs')).toBeVisible();
    await expect(page.getByText('Modules')).toBeVisible();
    await expect(page.getByText('Users')).toBeVisible();
    await expect(page.getByText('Roles')).toBeVisible();
    await expect(page.getByText('Groups')).toBeVisible();
    });
});
}
