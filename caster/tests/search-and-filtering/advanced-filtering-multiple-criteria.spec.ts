// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, expectCasterProjectOpen } from '../../fixtures';

test.describe('Search and Filtering', () => {
  test('Advanced Filtering with Multiple Criteria', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
    const projectName = `Multi Filter Project ${Date.now()}`;

    await expect(page.getByText('My Projects')).toBeVisible();

    await page.locator('button[mattooltip="Add New Project"]').click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill(projectName);
    await page.getByRole('button', { name: 'Save' }).click();
    cleanupCasterProject(await expectCasterProjectOpen(page, projectName));
    await page.getByRole('link', { name: 'Caster' }).click();

    const searchBar = page.getByRole('textbox', { name: 'Search' });
    await expect(searchBar).toBeVisible();

    await searchBar.fill(projectName);
    await searchBar.press('End');
    await expect(page.getByRole('link', { name: projectName })).toBeVisible();

    await searchBar.fill('NonexistentCriteria');
    await searchBar.press('End');
    await searchBar.clear();
    await searchBar.press('End');
    await expect(searchBar).toHaveValue('');
    await expect(page.getByText(/No data matching the filter/)).not.toBeVisible();
  });
});
