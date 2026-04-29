// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Search and Filtering', () => {
  test('Global Search Functionality', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {

    await expect(page.getByText('My Projects')).toBeVisible();

    await page.locator('button[mattooltip="Add New Project"]').click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill('Findable Project');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('link', { name: 'Findable Project' })).toBeVisible({ timeout: 10000 });

    // Register project for cleanup by extracting its ID from the link href
    const projectLink = page.getByRole('link', { name: 'Findable Project' });
    const href = await projectLink.getAttribute('href');
    if (href) {
      const projectId = href.split('/').pop();
      if (projectId) cleanupCasterProject(projectId);
    }

    const searchBar = page.getByRole('textbox', { name: 'Search' });
    await expect(searchBar).toBeVisible();

    await searchBar.fill('Findable');
    await expect(page.getByRole('link', { name: 'Findable Project' })).toBeVisible();

    await searchBar.fill('NonexistentSearchTerm');
    await searchBar.clear();
    await expect(page.getByRole('link', { name: 'Findable Project' })).toBeVisible();
  });
});
