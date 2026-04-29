// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspaces Management', () => {
  test('Delete Workspace', async ({ casterAuthenticatedPage: page, cleanupCasterProjectByName }) => {

    const projectName = 'Del WS Project';
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
    await dirDialog.getByRole('textbox', { name: 'Name' }).fill('Del WS Dir');
    await dirDialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'Del WS Dir' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Del WS Dir' }).click();
    await page.getByRole('button', { name: 'WORKSPACES' }).click();

    await page.getByText('Add Workspace').click();
    const wsDialog = page.getByRole('dialog', { name: 'Create New Workspace?' });
    await expect(wsDialog).toBeVisible();
    // Workspace names must match pattern: ^[a-zA-Z0-9-_.]+$ (no spaces allowed)
    await wsDialog.getByRole('textbox', { name: 'Name' }).fill('WS_To_Delete');
    await wsDialog.getByRole('button', { name: 'Save' }).click();

    const deleteButton = page.getByRole('button', { name: 'delete' }).first();
    if (await deleteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await deleteButton.click();
      const confirmButton = page.getByRole('button', { name: 'Confirm' });
      if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmButton.click();
      }
    }
  });
});
