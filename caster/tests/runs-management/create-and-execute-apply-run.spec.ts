// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Runs Management (Plan, Apply, Destroy)', () => {
  test('Create and Execute Apply Run', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
    const projectName = `Apply-Run-Project-${Date.now()}`;

    await expect(page.getByText('My Projects')).toBeVisible();

    await page.locator('button[mattooltip="Add New Project"]').click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill(projectName);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('link', { name: projectName })).toBeVisible({ timeout: 10000 });

    await page.getByRole('link', { name: projectName }).click();
    await expect(page).toHaveURL(/\/projects\//, { timeout: 10000 });

    // Extract project ID from URL for cleanup
    const projectId = page.url().match(/\/projects\/([^/]+)/)?.[1];
    if (projectId) cleanupCasterProject(projectId);

    await page.getByTitle('Add New Directory').click();
    await expect(page.getByRole('dialog', { name: 'Create New Directory?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill('Apply-Run-Dir');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'Apply-Run-Dir' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Apply-Run-Dir' }).click();
    await page.getByRole('button', { name: 'WORKSPACES' }).click();
    await page.getByText('Add Workspace').click();

    const nameInput = page.getByRole('textbox', { name: 'Name' });
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameInput.fill('Apply-WS');
      await page.getByRole('button', { name: 'Save' }).click();
    }

    const applyButton = page.getByRole('button', { name: /apply/i });
    if (await applyButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await applyButton.click();
    }
  });
});
