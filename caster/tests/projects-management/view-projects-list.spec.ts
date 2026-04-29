// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Projects Management', () => {
  test('View Projects List', async ({ casterAuthenticatedPage: page }) => {

    // 1. Navigate to http://localhost:4310/projects
    // expect: Projects page loads successfully
    await expect(page).toHaveURL(/localhost:4310/, { timeout: 30000 });

    // expect: Projects list is displayed in a table format
    await expect(page.getByText('My Projects')).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    // expect: Each project shows: name with column header 'Project Name'
    await expect(page.getByRole('button', { name: 'Project Name' })).toBeVisible();

    // expect: Actions column is visible
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();

    // expect: A search box is available
    await expect(page.getByRole('textbox', { name: 'Search' })).toBeVisible();
  });
});
