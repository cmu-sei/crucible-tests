// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspaces Management', () => {
  test('View Workspaces List', async ({ casterAuthenticatedPage: page, cleanupCasterProjectByName }) => {

    const projectName = 'View WS List Project';
    await cleanupCasterProjectByName(projectName);

    // Setup: Create a project and directory
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
    await dirDialog.getByRole('textbox', { name: 'Name' }).fill('WS List Dir');
    await dirDialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'WS List Dir' })).toBeVisible({ timeout: 10000 });

    // Expand directory and navigate to WORKSPACES
    await page.getByRole('button', { name: 'WS List Dir' }).click();

    // expect: WORKSPACES section is available
    await expect(page.getByRole('button', { name: 'WORKSPACES' })).toBeVisible();

    // Click to expand WORKSPACES
    await page.getByRole('button', { name: 'WORKSPACES' }).click();

    // expect: Workspaces section shows Add Workspace option
    await expect(page.getByText('Add Workspace')).toBeVisible();
  });
});
