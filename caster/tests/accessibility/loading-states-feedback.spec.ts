// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Accessibility and Usability', () => {
  test('Loading States and Feedback', async ({ casterAuthenticatedPage: page }) => {

    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();

    // The add-project button is the only button sibling of "My Projects" text
    await page.getByText('My Projects').locator('..').getByRole('button').click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    const projectName = `Loading Test Project ${Date.now()}`;
    await page.getByRole('textbox', { name: 'Name' }).fill(projectName);

    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // expect: Dialog closes and project appears
    await expect(page.getByRole('link', { name: projectName })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).not.toBeVisible();

    // Cleanup: delete the project created during the test
    const projectRow = page.getByRole('row').filter({ hasText: projectName });
    const deleteButton = projectRow.getByRole('button').last();
    await deleteButton.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Confirm|Delete|Yes/ }).click();
    await expect(page.getByRole('link', { name: projectName })).not.toBeVisible({ timeout: 10000 });
  });
});
