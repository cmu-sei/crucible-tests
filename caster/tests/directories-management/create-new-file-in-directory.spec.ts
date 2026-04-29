// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Directories Management', () => {
  test('Create New File in Directory', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
    const uniqueSuffix = Date.now().toString();

    // Setup: Create a project and directory
    await expect(page.getByText('My Projects')).toBeVisible();

    await page.locator('button:has(.mdi-plus-circle)').click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill(`File Test Project ${uniqueSuffix}`);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('link', { name: `File Test Project ${uniqueSuffix}` })).toBeVisible({ timeout: 10000 });

    await page.getByRole('link', { name: `File Test Project ${uniqueSuffix}` }).click();
    await expect(page).toHaveURL(/\/projects\//, { timeout: 10000 });

    // Register project for cleanup after test completes
    const projectId = page.url().match(/\/projects\/([a-f0-9-]+)/)?.[1];
    if (projectId) cleanupCasterProject(projectId);

    await page.getByText('Add Directory').first().click();
    await expect(page.getByRole('dialog', { name: 'Create New Directory?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill('File Directory');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'File Directory' })).toBeVisible({ timeout: 10000 });

    // Expand directory and FILES section
    await page.getByRole('button', { name: 'File Directory' }).click();
    await page.getByRole('button', { name: 'FILES' }).click();

    // 2. Click 'Add File' button
    await page.getByText('Add File').click();

    // expect: A file creation dialog is displayed
    await expect(page.getByRole('dialog', { name: 'Create New File?' })).toBeVisible({ timeout: 5000 });

    // 3. Enter 'main.tf' as the filename
    const fileNameInput = page.getByRole('textbox', { name: 'Name' });
    await expect(fileNameInput).toBeVisible({ timeout: 5000 });
    await fileNameInput.fill('main.tf');

    // expect: Filename field accepts input
    await expect(fileNameInput).toHaveValue('main.tf');
  });
});
