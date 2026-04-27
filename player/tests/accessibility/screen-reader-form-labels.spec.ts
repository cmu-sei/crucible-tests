// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Responsive Design and Accessibility', () => {
  test('Screen Reader - Form Labels', async ({ playerAuthenticatedPage: page }) => {
    // 1. Navigate to a form
    // Open the create view dialog
    const createButton = page.locator('button:has(.mdi-plus-circle)');
    await createButton.click();

    const dialog = page.getByRole('dialog', { name: 'Create New View?' });
    await expect(dialog).toBeVisible();

    // expect: All form fields have associated labels
    // expect: Labels are programmatically linked to inputs
    const nameField = dialog.getByRole('textbox', { name: 'Name' });
    await expect(nameField).toBeVisible();

    // expect: Screen reader announces labels correctly
    // The textbox should have an accessible name
    await expect(nameField).toHaveAccessibleName(/Name/);

    // Close dialog
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    // Check admin form labels
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // Search field should have a label
    await expect(page.getByRole('textbox', { name: 'Search' })).toBeVisible();
  });
});
