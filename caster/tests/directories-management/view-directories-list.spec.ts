// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Directories Management', () => {
  test('View Directories List', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
    const uniqueSuffix = Date.now().toString();

    // Setup: Create a project with a directory
    await expect(page.getByText('My Projects')).toBeVisible();

    // Create project
    await page.locator('button:has(.mdi-plus-circle)').click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill(`View Dir List Project ${uniqueSuffix}`);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('link', { name: `View Dir List Project ${uniqueSuffix}` })).toBeVisible({ timeout: 10000 });

    // Navigate to project
    await page.getByRole('link', { name: `View Dir List Project ${uniqueSuffix}` }).click();
    await expect(page).toHaveURL(/\/projects\//, { timeout: 10000 });

    // Register project for cleanup after test completes
    const projectId = page.url().match(/\/projects\/([a-f0-9-]+)/)?.[1];
    if (projectId) cleanupCasterProject(projectId);

    // Create directory
    await page.getByText('Add Directory').first().click();
    await expect(page.getByRole('dialog', { name: 'Create New Directory?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill('Listed Directory');
    await page.getByRole('button', { name: 'Save' }).click();

    // expect: Directories are displayed in the project sidebar
    await expect(page.getByRole('button', { name: 'Listed Directory' })).toBeVisible({ timeout: 10000 });

    // expect: Add Directory option is visible in the sidebar
    await expect(page.getByText('Add Directory').nth(1)).toBeVisible();
  });
});
