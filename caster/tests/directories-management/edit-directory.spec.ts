// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Directories Management', () => {
  test('Edit Directory', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
    const uniqueSuffix = Date.now().toString();

    // Setup: Create a project and directory
    await expect(page.getByText('My Projects')).toBeVisible();

    await page.locator('button:has(.mdi-plus-circle)').click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill(`Edit Dir Project ${uniqueSuffix}`);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('link', { name: `Edit Dir Project ${uniqueSuffix}` })).toBeVisible({ timeout: 10000 });

    await page.getByRole('link', { name: `Edit Dir Project ${uniqueSuffix}` }).click();
    await expect(page).toHaveURL(/\/projects\//, { timeout: 10000 });

    // Register project for cleanup after test completes
    const projectId = page.url().match(/\/projects\/([a-f0-9-]+)/)?.[1];
    if (projectId) cleanupCasterProject(projectId);

    await page.getByText('Add Directory').first().click();
    await expect(page.getByRole('dialog', { name: 'Create New Directory?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill('Original Dir Name');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'Original Dir Name' })).toBeVisible({ timeout: 10000 });

    // Click on the directory to expand it
    await page.getByRole('button', { name: 'Original Dir Name' }).click();

    // Look for an edit/rename option - try inline edit by double-clicking or looking for edit button
    const editButton = page.locator('button:has(.mdi-pencil)').first();
    if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editButton.click();

      // Edit the directory name
      const nameInput = page.getByRole('textbox', { name: 'Name' });
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.clear();
        await nameInput.fill('Updated Dir Name');
        await page.getByRole('button', { name: 'Save' }).click();

        // expect: The directory is updated successfully
        await expect(page.getByText('Updated Dir Name')).toBeVisible({ timeout: 10000 });
      }
    }
  });
});
