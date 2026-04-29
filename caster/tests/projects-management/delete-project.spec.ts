// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Projects Management', () => {
  test('Delete Project', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {

    // 1. Navigate to Projects section
    // expect: Projects list is visible
    await expect(page.getByText('My Projects')).toBeVisible();

    // Create a project to delete
    await page.locator('button[mattooltip="Add New Project"]').click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill('Project To Delete');

    const createResponsePromise = page.waitForResponse(resp =>
      resp.url().includes('/api/projects') && resp.request().method() === 'POST' && resp.ok()
    );
    await page.getByRole('button', { name: 'Save' }).click();

    // Capture project ID for cleanup (in case deletion fails mid-test)
    const createResponse = await createResponsePromise;
    const projectData = await createResponse.json();
    const projectId = projectData.id;
    cleanupCasterProject(projectId);

    await expect(page.getByRole('link', { name: 'Project To Delete' })).toBeVisible({ timeout: 10000 });

    // 2. Click the delete icon for the project
    const projectRow = page.getByRole('row').filter({ hasText: 'Project To Delete' });
    const deleteButton = projectRow.getByRole('button').last();
    await deleteButton.click();

    // expect: A confirmation dialog appears asking to confirm deletion
    await expect(page.getByRole('dialog', { name: 'Delete Project?' })).toBeVisible({ timeout: 5000 });

    // 3. Click 'No' in the confirmation dialog to cancel
    await page.getByRole('button', { name: 'No' }).click();

    // expect: The dialog closes
    // expect: The project is not deleted
    await expect(page.getByRole('dialog', { name: 'Delete Project?' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Project To Delete' })).toBeVisible();

    // 4. Click the delete icon again
    await deleteButton.click();

    // expect: Confirmation dialog appears again
    await expect(page.getByRole('dialog', { name: 'Delete Project?' })).toBeVisible({ timeout: 5000 });

    // 5. Click 'Delete' button to confirm deletion
    await page.getByRole('dialog', { name: 'Delete Project?' }).getByRole('button', { name: 'Delete' }).click();

    // expect: The project is deleted successfully
    // expect: The project is removed from the list
    await expect(page.getByRole('link', { name: 'Project To Delete' })).not.toBeVisible({ timeout: 10000 });
  });
});
