// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Home Page and Navigation', () => {
  test('Home Page Initial Load', async ({ casterAuthenticatedPage: page }) => {

    // 1. Log in as admin user and navigate to http://localhost:4310
    // expect: The home page loads successfully
    await expect(page).toHaveURL(/localhost:4310/, { timeout: 30000 });

    // expect: The topbar is visible with application branding
    // expect: The topbar displays 'Caster' or configured AppTopBarText
    await expect(page.getByText('Caster').first()).toBeVisible({ timeout: 10000 });

    // expect: The user's username is displayed in the topbar
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();

    // expect: The main navigation menu is visible with sections: Projects
    await expect(page.getByText('My Projects')).toBeVisible();

    // expect: The projects table is visible
    await expect(page.getByRole('table')).toBeVisible();
  });
});
