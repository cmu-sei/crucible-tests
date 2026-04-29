// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Performance and Optimization', () => {
  test('Long Running Operation Handling', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {

    await expect(page.getByText('My Projects')).toBeVisible();

    await page.locator('button[mattooltip="Add New Project"]').click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill('Long Running Test');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('link', { name: 'Long Running Test' }).first()).toBeVisible({ timeout: 10000 });

    await page.getByRole('link', { name: 'Long Running Test' }).first().click();
    await expect(page).toHaveURL(/\/projects\//, { timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();

    // Extract the project ID from the URL and register it for cleanup
    const projectId = page.url().match(/\/projects\/([a-f0-9-]+)/)?.[1];
    if (projectId) {
      cleanupCasterProject(projectId);
    }

    await page.goto(Services.Caster.UI + '/admin');
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 10000 });

    await page.goBack();
    await expect(page).toHaveURL(/\/projects\//, { timeout: 10000 });
  });
});
