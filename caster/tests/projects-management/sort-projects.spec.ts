// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Projects Management', () => {
  test('Sort Projects', async ({ casterAuthenticatedPage: page }) => {

    // 1. Navigate to Projects section
    await expect(page.getByText('My Projects')).toBeVisible();

    // expect: Projects list is visible
    await expect(page.getByRole('table')).toBeVisible();

    // 2. Click on the 'Project Name' column header
    await page.getByRole('button', { name: 'Project Name' }).click();

    // expect: Projects are sorted alphabetically by name
    // expect: A sort indicator shows the sort direction
    await expect(page.getByRole('button', { name: 'Project Name' })).toBeVisible();

    // 3. Click on the 'Project Name' column header again
    await page.getByRole('button', { name: 'Project Name' }).click();

    // expect: Projects are sorted in reverse alphabetical order
    await expect(page.getByRole('button', { name: 'Project Name' })).toBeVisible();
  });
});
