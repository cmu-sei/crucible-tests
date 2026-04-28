// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Home Page and Navigation', () => {
  test('Home Page Initial Load', async ({ page }) => {
    // 1. Log in as admin user and navigate to http://localhost:4403
    await authenticateWithKeycloak(page, Services.Alloy.UI);

    // expect: The home page loads successfully
    await expect(page).toHaveURL(/localhost:4403/);

    // expect: The topbar is visible with application branding
    // expect: The topbar displays 'Alloy' or configured AppTopBarText
    await expect(page.getByRole('link', { name: 'Alloy' })).toBeVisible();

    // expect: Home link is visible in topbar
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();

    // expect: The user's username is displayed in the topbar
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();

    // expect: The main content area displays event list or welcome content
    await expect(page.getByText('My Events')).toBeVisible();
  });
});
