// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Designs Management', () => {
  test('View Designs List', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
    const uniqueName = `Designs Test Project ${Date.now()}`;

    await expect(page.getByText('My Projects')).toBeVisible();

    await page.locator('button[mattooltip="Add New Project"]').click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill(uniqueName);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('link', { name: uniqueName })).toBeVisible({ timeout: 10000 });

    await page.getByRole('link', { name: uniqueName }).click();
    await expect(page).toHaveURL(/\/projects\//, { timeout: 10000 });

    // Register project for cleanup using the ID from the URL
    const projectId = page.url().match(/\/projects\/([^/]+)/)?.[1];
    if (projectId) cleanupCasterProject(projectId);

    await page.getByTitle('Add New Directory').click();
    await expect(page.getByRole('dialog', { name: 'Create New Directory?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill('Designs Directory');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'Designs Directory' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Designs Directory' }).click();
    await expect(page.getByRole('button', { name: 'DESIGNS', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'DESIGNS', exact: true }).click();
  });
});
