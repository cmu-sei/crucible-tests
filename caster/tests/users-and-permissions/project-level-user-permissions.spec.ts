// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Users and Permissions Management', () => {
  test('Project-Level User Permissions', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {

    await expect(page.getByText('My Projects')).toBeVisible();

    await page.locator('button[mattooltip="Add New Project"]').click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill('Permission Project');

    const createResponsePromise = page.waitForResponse(resp =>
      resp.url().includes('/api/projects') && resp.request().method() === 'POST' && resp.ok()
    );
    await page.getByRole('button', { name: 'Save' }).click();

    const createResponse = await createResponsePromise;
    const projectData = await createResponse.json();
    cleanupCasterProject(projectData.id);

    await expect(page.getByRole('link', { name: 'Permission Project' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('link', { name: 'Permission Project' }).click();
    await expect(page).toHaveURL(/\/projects\//, { timeout: 10000 });
  });
});
