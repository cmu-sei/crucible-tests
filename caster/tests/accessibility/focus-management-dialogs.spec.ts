// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Accessibility and Usability', () => {
  test('Focus Management in Dialogs', async ({ casterAuthenticatedPage: page }) => {

    await expect(page.getByText('My Projects')).toBeVisible();

    // The add-project button is the only button sibling of "My Projects" text
    const addProjectButton = page.getByText('My Projects').locator('..').getByRole('button');
    await addProjectButton.click();

    const dialog = page.getByRole('dialog', { name: 'Create New Project?' });
    await expect(dialog).toBeVisible();

    // expect: Focus is moved to the dialog when it opens
    await expect(page.getByRole('textbox', { name: 'Name' })).toBeFocused();

    // The dialog has disableClose set, so Escape does not close it.
    // Verify Cancel button closes the dialog instead.
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();

    // Reopen dialog and verify focus management is consistent
    await addProjectButton.click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Name' })).toBeFocused();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).not.toBeVisible();
  });
});
