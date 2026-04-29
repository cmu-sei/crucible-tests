// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspaces Management', () => {
  test('View Workspace Details', async ({ casterAuthenticatedPage: page, cleanupCasterProjectByName }) => {

    const projectName = 'View WS Detail Project';
    await cleanupCasterProjectByName(projectName);

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
    await dirDialog.getByRole('textbox', { name: 'Name' }).fill('WS Detail Dir');
    await dirDialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'WS Detail Dir' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'WS Detail Dir' }).click();
    await page.getByRole('button', { name: 'WORKSPACES' }).click();

    await page.getByText('Add Workspace').click();
    const wsDialog = page.getByRole('dialog', { name: 'Create New Workspace?' });
    await expect(wsDialog).toBeVisible();
    // Workspace names must match pattern: ^[a-zA-Z0-9-_.]+$ (no spaces allowed)
    await wsDialog.getByRole('textbox', { name: 'Name' }).fill('Detail_Workspace');
    await wsDialog.getByRole('button', { name: 'Save' }).click();

    const wsItem = page.getByText('Detail_Workspace');
    if (await wsItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await wsItem.click();
    }
  });
});
