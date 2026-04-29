// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Error Handling and Validation', () => {
  test('Duplicate Name Validation', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {

    await expect(page.getByText('My Projects')).toBeVisible();

    const projectName = `DupTest ${Date.now()}`;

    // Helper: intercept the project-creation API response to capture the project ID
    async function createProjectAndRegisterCleanup(name: string) {
      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/api/projects') && resp.request().method() === 'POST' && resp.status() === 201
      );
      await page.locator('button[mattooltip="Add New Project"]').click();
      await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
      await page.getByRole('textbox', { name: 'Name' }).fill(name);
      await page.getByRole('button', { name: 'Save' }).click();
      const response = await responsePromise;
      const body = await response.json();
      cleanupCasterProject(body.id);
    }

    // 1. Create a project
    await createProjectAndRegisterCleanup(projectName);
    await expect(page.getByRole('link', { name: projectName })).toBeVisible({ timeout: 10000 });

    // 2. Attempt to create another with the same name
    await createProjectAndRegisterCleanup(projectName);

    // The app allows duplicate project names - the dialog closes and a second project appears.
    // Wait for the dialog to close, confirming the save was accepted.
    const dialog = page.getByRole('dialog', { name: 'Create New Project?' });
    await expect(dialog).toBeHidden({ timeout: 10000 });

    // Verify both projects exist in the list
    await expect(page.getByRole('link', { name: projectName }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: projectName }).nth(1)).toBeVisible();
  });
});
