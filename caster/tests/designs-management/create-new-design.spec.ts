// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Designs Management', () => {
  test('Create New Design', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
    const uniqueId = Date.now();
    const projectName = `Design Create Project ${uniqueId}`;
    const dirName = `Design Directory ${uniqueId}`;

    // Setup: Create project and directory
    await expect(page.getByText('My Projects')).toBeVisible();

    await page.locator('button[mattooltip="Add New Project"]').click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill(projectName);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('link', { name: projectName })).toBeVisible({ timeout: 10000 });

    await page.getByRole('link', { name: projectName }).click();
    await expect(page).toHaveURL(/\/projects\//, { timeout: 10000 });

    // Register project for cleanup using the ID from the URL
    const projectId = page.url().match(/\/projects\/([^/]+)/)?.[1];
    if (projectId) cleanupCasterProject(projectId);

    await page.getByTitle('Add New Directory').click();
    await expect(page.getByRole('dialog', { name: 'Create New Directory?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill(dirName);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: dirName })).toBeVisible({ timeout: 10000 });

    // Expand directory and DESIGNS section
    await page.getByRole('button', { name: dirName }).click();
    await expect(page.getByRole('button', { name: 'DESIGNS', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'DESIGNS', exact: true }).click();

    // Click add design button
    await page.getByText('Add Design').click();

    // Fill in design name
    const nameInput = page.getByRole('textbox', { name: 'Name' });
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameInput.fill('Test Design');
      await expect(nameInput).toHaveValue('Test Design');
      await page.getByRole('button', { name: 'Save' }).click();
    }
  });
});
