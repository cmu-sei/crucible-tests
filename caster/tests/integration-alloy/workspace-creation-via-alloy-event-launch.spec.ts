// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Integration with Alloy', () => {
  test('Workspace Creation via Alloy Event Launch', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
    const projectName = `Alloy Integration Project ${Date.now()}`;

    await expect(page.getByText('My Projects')).toBeVisible();

    await page.locator('button').filter({ has: page.locator('mat-icon[fonticon="mdi-plus-circle"]') }).first().click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill(projectName);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('link', { name: projectName })).toBeVisible({ timeout: 10000 });

    await page.getByRole('link', { name: projectName }).click();
    await page.waitForURL(/\/projects\//, { timeout: 10000 });

    // Extract the project ID from the URL and register it for cleanup
    const projectId = page.url().match(/\/projects\/([a-f0-9-]+)/)?.[1];
    if (projectId) cleanupCasterProject(projectId);

    await page.getByTitle('Add New Directory').click();
    await expect(page.getByRole('dialog', { name: 'Create New Directory?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill('Alloy Dir');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'Alloy Dir' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Alloy Dir' }).click();
    const workspacesButton = page.getByRole('button', { name: /WORKSPACES/i });
    await expect(workspacesButton).toBeVisible({ timeout: 10000 });
    await workspacesButton.click();
    await expect(page.getByText('Add Workspace')).toBeVisible({ timeout: 10000 });
  });
});
