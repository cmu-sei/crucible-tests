// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Error Handling and Validation', () => {
  test('Terraform Syntax Error Handling', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {

    await expect(page.getByText('My Projects')).toBeVisible();

    const projectName = `TF Error ${Date.now()}`;

    // Intercept the project-creation API response to capture the project ID for cleanup
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/projects') && resp.request().method() === 'POST' && resp.status() === 201
    );
    await page.locator('button[mattooltip="Add New Project"]').click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill(projectName);
    await page.getByRole('button', { name: 'Save' }).click();
    const response = await responsePromise;
    const body = await response.json();
    cleanupCasterProject(body.id);
    await expect(page.getByRole('link', { name: projectName })).toBeVisible({ timeout: 10000 });

    await page.getByRole('link', { name: projectName }).click();
    await expect(page).toHaveURL(/\/projects\//, { timeout: 10000 });

    await page.getByTitle('Add New Directory').click();
    await expect(page.getByRole('dialog', { name: 'Create New Directory?' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Name' }).fill('TF Error Dir');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'TF Error Dir' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'TF Error Dir' }).click();
    await page.getByRole('button', { name: 'FILES' }).click();

    await page.getByText('Add File').click();
    // After clicking "Add File", an inline textbox appears for the filename.
    // Wait for any new textbox to appear and use a longer timeout for Firefox.
    const fileNameInput = page.getByRole('textbox').last();
    await expect(fileNameInput).toBeVisible({ timeout: 10000 });
    await fileNameInput.fill('bad.tf');
  });
});
