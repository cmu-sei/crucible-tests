// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Directories Management', () => {
  test('Create New Directory', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
    const uniqueSuffix = Date.now().toString();

    // 1. Navigate to Caster and create a project
    await expect(page.getByText('My Projects')).toBeVisible();

    // Create project - click the "+" button next to "My Projects"
    await page.locator('button:has(.mdi-plus-circle)').click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill(`Directory Test Project ${uniqueSuffix}`);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('link', { name: `Directory Test Project ${uniqueSuffix}` })).toBeVisible({ timeout: 10000 });

    // Navigate to the project
    await page.getByRole('link', { name: `Directory Test Project ${uniqueSuffix}` }).click();
    await expect(page).toHaveURL(/\/projects\//, { timeout: 10000 });

    // Register project for cleanup after test completes
    const projectId = page.url().match(/\/projects\/([a-f0-9-]+)/)?.[1];
    if (projectId) cleanupCasterProject(projectId);

    // 2. Click 'Add Directory' button
    await page.getByText('Add Directory').first().click();

    // expect: A directory creation dialog is displayed
    const createDirectoryDialog = page.getByRole('dialog', { name: 'Create New Directory?' });
    await expect(createDirectoryDialog).toBeVisible();

    // 3. Enter 'Test Infrastructure Directory' in the Name field
    const nameField = createDirectoryDialog.getByRole('textbox', { name: 'Name' });
    await nameField.fill('Test Infrastructure Directory');

    // expect: The name field accepts input
    await expect(nameField).toHaveValue('Test Infrastructure Directory');

    // 7. Click 'Save' button
    await createDirectoryDialog.getByRole('button', { name: 'Save' }).click();

    // expect: The directory is created successfully
    // expect: The new directory appears in the sidebar
    await expect(page.getByRole('button', { name: 'Test Infrastructure Directory' })).toBeVisible({ timeout: 10000 });
  });
});
