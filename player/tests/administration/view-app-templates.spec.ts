// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Application Templates', () => {
  test('View Application Templates', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();

    // expect: The Administration page is displayed
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // 2. Click the 'Application Templates' button
    await page.getByRole('button', { name: 'Application Templates' }).click();

    // expect: The Application Templates section is displayed
    await expect(page).toHaveURL(/section=application-templates/);

    // expect: A table shows templates with columns: checkbox, Template Name, Url
    await expect(page.getByRole('columnheader', { name: 'Template Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Url' })).toBeVisible();

    // expect: Templates include Dashboard, Map, and Virtual Machines with their respective URLs
    await expect(page.getByText('Dashboard').first()).toBeVisible();
    await expect(page.getByText('Map').first()).toBeVisible();
    await expect(page.getByText('Virtual Machines').first()).toBeVisible();
  });
});
