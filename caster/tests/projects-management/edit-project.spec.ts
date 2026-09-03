// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, expectCasterProjectOpen } from '../../fixtures';

test.describe('Projects Management', () => {
  test('Edit Project', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
    const projectName = `Project To Edit ${Date.now()}`;
    const updatedProjectName = `Updated Project Name ${Date.now()}`;

    // 1. Navigate to Projects section
    // expect: Projects list is visible with at least one project
    await expect(page.getByText('My Projects')).toBeVisible();

    // Create a project first if none exist
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
    const searchBox = page.getByRole('textbox', { name: 'Search' });
    await searchBox.fill(projectName);
    await searchBox.press('End');

    // 2. Click on the edit icon for the project
    const projectRow = page.getByRole('row').filter({ hasText: projectName });
    const editButton = projectRow.getByRole('button').first();
    await editButton.click();

    // expect: The project edit dialog is displayed
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // 3. Modify the Name field
    const nameField = page.getByRole('textbox', { name: 'Name' });
    await expect(nameField).toBeVisible();
    await nameField.clear();
    await nameField.fill(updatedProjectName);

    // expect: The name field accepts the new value
    await expect(nameField).toHaveValue(updatedProjectName);

    // 4. Click 'Save' button
    await page.getByRole('button', { name: 'Save' }).click();

    // expect: The updated name is reflected in the project list.
    await searchBox.fill(updatedProjectName);
    await searchBox.press('End');
    await expect(page.getByRole('link', { name: updatedProjectName })).toBeVisible();
  });
});
