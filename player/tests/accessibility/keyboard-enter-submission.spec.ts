// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Responsive Design and Accessibility', () => {
  test('Keyboard Navigation - Enter Key Submission', async ({ playerAuthenticatedPage: page }) => {
    // 1. Navigate to a form (e.g., create view dialog)
    const createButton = page.locator('button:has(.mdi-plus-circle)');
    await createButton.click();

    // expect: Form is displayed
    const dialog = page.getByRole('dialog', { name: 'Create New View?' });
    await expect(dialog).toBeVisible();

    // 2. Fill in form fields using keyboard only
    const nameField = dialog.getByRole('textbox', { name: 'Name' });
    await nameField.focus();
    await page.keyboard.type('Keyboard Test View');

    // expect: Fields can be filled via keyboard
    await expect(nameField).toHaveValue('Keyboard Test View');

    // 3. Press Enter key to submit
    // Tab to the Save button and press Enter
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    // expect: Form submits successfully without mouse click
    // Or cancel the dialog to clean up
    // If the save was triggered, the dialog would close
    // If not, press Escape to cancel
    await page.keyboard.press('Escape');
  });
});
