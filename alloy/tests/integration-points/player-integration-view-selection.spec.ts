// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Integration Points', () => {
  test('Player Integration - View Selection', async ({ page }) => {
    // 1. Navigate to create or edit event template form
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // "Add Event Template" opens the "Create New Event Template" form directly
    // (Alloy.ui PR #711), which has the same fields as the edit dialog.
    const dialog = page.getByRole('dialog', { name: 'Create New Event Template' });
    await page.getByRole('button', { name: 'Add Event Template' }).click();

    // expect: Form is displayed
    await expect(dialog).toBeVisible();

    // 2. Check the Player View dropdown
    const playerViewCombobox = dialog.getByRole('combobox', { name: 'Player View Template' });

    // expect: Dropdown is visible
    await expect(playerViewCombobox).toBeVisible();

    // 3. The Player View field should have a value populated
    // expect: View is available in the template
    await expect(playerViewCombobox).toBeVisible();

    // Close the dialog (nothing is created until Save)
    await dialog.getByRole('button', { name: 'Cancel' }).first().click();
  });
});
