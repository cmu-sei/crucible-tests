// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Search and Filtering', () => {
  test('Filter by Project', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {

    await expect(page.getByText('My Projects')).toBeVisible();

    // Create two projects
    await page.locator('button[mattooltip="Add New Project"]').click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill('Filter Alpha Project');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('link', { name: 'Filter Alpha Project' })).toBeVisible({ timeout: 10000 });

    // Register first project for cleanup
    const alphaLink = page.getByRole('link', { name: 'Filter Alpha Project' });
    const alphaHref = await alphaLink.getAttribute('href');
    if (alphaHref) {
      const alphaId = alphaHref.split('/').pop();
      if (alphaId) cleanupCasterProject(alphaId);
    }

    await page.locator('button[mattooltip="Add New Project"]').click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill('Filter Beta Project');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('link', { name: 'Filter Beta Project' })).toBeVisible({ timeout: 10000 });

    // Register second project for cleanup
    const betaLink = page.getByRole('link', { name: 'Filter Beta Project' });
    const betaHref = await betaLink.getAttribute('href');
    if (betaHref) {
      const betaId = betaHref.split('/').pop();
      if (betaId) cleanupCasterProject(betaId);
    }

    const searchBar = page.getByRole('textbox', { name: 'Search' });
    await expect(searchBar).toBeVisible();

    await searchBar.fill('Alpha');
    await expect(page.getByRole('link', { name: 'Filter Alpha Project' })).toBeVisible();

    await searchBar.clear();
    await expect(page.getByRole('link', { name: 'Filter Alpha Project' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Filter Beta Project' })).toBeVisible();
  });
});
