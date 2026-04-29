// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspaces Management', () => {
  test('Create New Workspace', async ({ casterAuthenticatedPage: page, cleanupCasterProjectByName }) => {

    const projectName = 'Workspace Test Project';
    await cleanupCasterProjectByName(projectName);

    // Setup: Create project and directory first
    await expect(page.getByText('My Projects')).toBeVisible();
    await page.reload();

    await page.locator('[mattooltip="Add New Project"]').click();
    const projectDialog = page.getByRole('dialog', { name: 'Create New Project?' });
    await expect(projectDialog).toBeVisible();
    await projectDialog.getByRole('textbox', { name: 'Name' }).fill(projectName);
    await projectDialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('link', { name: projectName })).toBeVisible({ timeout: 10000 });

    await page.getByRole('link', { name: projectName }).click();
    await expect(page).toHaveURL(/\/projects\//, { timeout: 10000 });

    await page.getByTitle('Add New Directory').click();
    const dirDialog = page.getByRole('dialog', { name: 'Create New Directory?' });
    await expect(dirDialog).toBeVisible();
    await dirDialog.getByRole('textbox', { name: 'Name' }).fill('Workspace Directory');
    await dirDialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'Workspace Directory' })).toBeVisible({ timeout: 10000 });

    // Expand directory and WORKSPACES section
    await page.getByRole('button', { name: 'Workspace Directory' }).click();
    await page.getByRole('button', { name: 'WORKSPACES' }).click();

    // 2. Click 'Add Workspace' button
    await page.getByText('Add Workspace').click();

    // expect: A workspace creation dialog or inline form is displayed
    const wsDialog = page.getByRole('dialog', { name: 'Create New Workspace?' });
    await expect(wsDialog).toBeVisible();
    // Workspace names must match pattern: ^[a-zA-Z0-9-_.]+$ (no spaces allowed)
    await wsDialog.getByRole('textbox', { name: 'Name' }).fill('Test_Workspace');
    await wsDialog.getByRole('button', { name: 'Save' }).click();
  });
});
