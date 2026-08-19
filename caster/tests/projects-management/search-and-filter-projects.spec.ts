// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import type { Page } from '@playwright/test';
import { test, expect, expectCasterProjectOpen } from '../../fixtures';

/**
 * Create a project from the home page and return to the home page.
 *
 * Saving navigates into the new project, so callers that want to keep working
 * with the project list have to come back — this keeps that round trip in one
 * place. Returns the new project's ID for cleanup registration.
 */
async function createProject(page: Page, name: string): Promise<string> {
  await page.locator('button[mattooltip="Add New Project"]').click();
  await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Name' }).fill(name);

  const createResponsePromise = page.waitForResponse(resp =>
    resp.url().includes('/api/projects') && resp.request().method() === 'POST' && resp.ok()
  );
  await page.getByRole('button', { name: 'Save' }).click();
  const projectData = await (await createResponsePromise).json();

  await expectCasterProjectOpen(page, name);
  await page.getByRole('link', { name: 'Caster' }).click();

  return projectData.id;
}

test.describe('Projects Management', () => {
  test('Search and Filter Projects', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
    // Two projects, because filtering can only be proven by what it *excludes*.
    // Both are seeded by this test rather than assumed to exist: "My Projects"
    // lists only projects the user is a member of, and every test in this suite
    // deletes what it creates, so the list is empty at the start of a clean run.
    const stamp = Date.now();
    const matchingName = `Searchable Project ${stamp}`;
    const otherName = `Unrelated Project ${stamp}`;

    // 1. Navigate to Projects section
    await expect(page.getByText('My Projects')).toBeVisible();

    cleanupCasterProject(await createProject(page, matchingName));
    cleanupCasterProject(await createProject(page, otherName));

    const matchingRow = page.getByRole('link', { name: matchingName });
    const otherRow = page.getByRole('link', { name: otherName });

    // expect: Projects list is visible with multiple projects
    await expect(matchingRow).toBeVisible();
    await expect(otherRow).toBeVisible();

    // 2. Enter a search term in the search box
    const searchBox = page.getByRole('textbox', { name: 'Search' });
    await searchBox.fill(matchingName);
    await searchBox.press('End');

    // expect: The list filters to show only projects matching the search term
    await expect(matchingRow).toBeVisible();
    await expect(otherRow).not.toBeVisible();

    // 3. Clear the search box
    await searchBox.clear();
    await searchBox.press('End');

    // expect: All projects are displayed again
    await expect(searchBox).toHaveValue('');
    await expect(page.getByText(/No data matching the filter/)).not.toBeVisible();
    await expect(matchingRow).toBeVisible();
    await expect(otherRow).toBeVisible();
  });
});
