// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Directories Management', () => {
  test('View Directory Details and Files', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
    const uniqueSuffix = Date.now().toString();

    // Setup: Create a project and directory
    await expect(page.getByText('My Projects')).toBeVisible();

    await page.locator('button:has(.mdi-plus-circle)').click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill(`Dir Details Project ${uniqueSuffix}`);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('link', { name: `Dir Details Project ${uniqueSuffix}` })).toBeVisible({ timeout: 10000 });

    await page.getByRole('link', { name: `Dir Details Project ${uniqueSuffix}` }).click();
    await expect(page).toHaveURL(/\/projects\//, { timeout: 10000 });

    // Register project for cleanup after test completes
    const projectId = page.url().match(/\/projects\/([a-f0-9-]+)/)?.[1];
    if (projectId) cleanupCasterProject(projectId);

    await page.getByText('Add Directory').first().click();
    await expect(page.getByRole('dialog', { name: 'Create New Directory?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill('Detail Directory');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'Detail Directory' })).toBeVisible({ timeout: 10000 });

    // 2. Click on the directory name
    await page.getByRole('button', { name: 'Detail Directory' }).click();

    // expect: Sections are available for: FILES, WORKSPACES, DIRECTORIES, DESIGNS
    await expect(page.getByRole('button', { name: 'FILES' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'WORKSPACES' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'DIRECTORIES' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'DESIGNS' })).toBeVisible();

    // Click FILES to expand file list
    await page.getByRole('button', { name: 'FILES' }).click();

    // expect: File section is expanded with Add File option
    await expect(page.getByText('Add File')).toBeVisible();
  });
});
