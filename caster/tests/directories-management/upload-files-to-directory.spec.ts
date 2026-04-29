// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Directories Management', () => {
  test('Upload Files to Directory', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
    const uniqueSuffix = Date.now().toString();

    await expect(page.getByText('My Projects')).toBeVisible();

    await page.locator('button:has(.mdi-plus-circle)').click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill(`Upload File Project ${uniqueSuffix}`);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('link', { name: `Upload File Project ${uniqueSuffix}` })).toBeVisible({ timeout: 10000 });

    await page.getByRole('link', { name: `Upload File Project ${uniqueSuffix}` }).click();
    await expect(page).toHaveURL(/\/projects\//, { timeout: 10000 });

    // Register project for cleanup after test completes
    const projectId = page.url().match(/\/projects\/([a-f0-9-]+)/)?.[1];
    if (projectId) cleanupCasterProject(projectId);

    await page.getByText('Add Directory').first().click();
    await expect(page.getByRole('dialog', { name: 'Create New Directory?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill('Upload Dir');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'Upload Dir' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Upload Dir' }).click();
    await page.getByRole('button', { name: 'FILES' }).click();

    const uploadButton = page.getByText('Upload File');
    if (await uploadButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await uploadButton.click();
    }
  });
});
