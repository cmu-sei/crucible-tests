// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, expectCasterProjectOpen } from '../../fixtures';

test.describe('Projects Management', () => {
  test('Search and Filter Projects', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
    const projectName = `Searchable Project ${Date.now()}`;

    // 1. Navigate to Projects section
    await expect(page.getByText('My Projects')).toBeVisible();

    // Create a project to search for
    await page.locator('button[mattooltip="Add New Project"]').click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill(projectName);

    const createResponsePromise = page.waitForResponse(resp =>
      resp.url().includes('/api/projects') && resp.request().method() === 'POST' && resp.ok()
    );
    await page.getByRole('button', { name: 'Save' }).click();

    // Capture project ID for cleanup
    const createResponse = await createResponsePromise;
    const projectData = await createResponse.json();
    cleanupCasterProject(projectData.id);

    await expectCasterProjectOpen(page, projectName);
    await page.getByRole('link', { name: 'Caster' }).click();

    // 2. Enter a search term in the search box
    const searchBox = page.getByRole('textbox', { name: 'Search' });
    await searchBox.fill(projectName);
    await searchBox.press('End');

    // expect: The list filters to show only projects matching the search term
    await expect(page.getByRole('link', { name: projectName })).toBeVisible();

    // 3. Clear the search box
    await searchBox.clear();
    await searchBox.press('End');

    // expect: The filter is removed and pagination returns to the full project list.
    await expect(searchBox).toHaveValue('');
    await expect(page.getByText(/No data matching the filter/)).not.toBeVisible();
    await expect(page.getByRole('status')).not.toHaveText('1 – 1 of 1');
  });
});
