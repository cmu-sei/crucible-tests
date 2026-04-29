// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Projects Management', () => {
  test('Create New Project', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {

    // 1. Navigate to Projects section
    // expect: Projects list is visible
    await expect(page.getByText('My Projects')).toBeVisible();

    // 2. Click 'Create Project' button (the + icon button near My Projects)
    await page.locator('button[mattooltip="Add New Project"]').click();

    // expect: A project creation dialog is displayed
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create New Project?' })).toBeVisible();

    // 3. Enter 'Test Infrastructure Project' in the Name field
    const nameField = page.getByRole('textbox', { name: 'Name' });
    await nameField.fill('Test Infrastructure Project');

    // expect: The name field accepts input
    await expect(nameField).toHaveValue('Test Infrastructure Project');

    // 4. Enter 'Test description' in the Description field
    const descField = page.getByRole('textbox', { name: 'Description' });
    await descField.fill('Test description');

    // expect: The description field accepts input
    await expect(descField).toHaveValue('Test description');

    // 5. Click 'Save' button
    const createResponsePromise = page.waitForResponse(resp =>
      resp.url().includes('/api/projects') && resp.request().method() === 'POST' && resp.ok()
    );
    await page.getByRole('button', { name: 'Save' }).click();

    // Capture project ID for cleanup
    const createResponse = await createResponsePromise;
    const projectData = await createResponse.json();
    cleanupCasterProject(projectData.id);

    // expect: The project is created successfully
    // expect: The new project appears in the projects list
    await expect(page.getByRole('link', { name: 'Test Infrastructure Project' })).toBeVisible({ timeout: 10000 });
  });
});
