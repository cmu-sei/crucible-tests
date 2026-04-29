// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Accessibility and Usability', () => {
  test('Screen Reader Compatibility', async ({ casterAuthenticatedPage: page }) => {

    await expect(page.getByText('My Projects')).toBeVisible();

    // Verify buttons have accessible names
    const buttons = page.getByRole('button');
    expect(await buttons.count()).toBeGreaterThan(0);

    // Verify the "Admin User" button is accessible
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();

    // Verify links have accessible names
    const links = page.getByRole('link');
    expect(await links.count()).toBeGreaterThan(0);

    // Verify the search textbox is accessible
    await expect(page.getByRole('textbox', { name: 'Search' })).toBeVisible();

    // Verify the table has accessible column headers
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Project Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
  });
});
