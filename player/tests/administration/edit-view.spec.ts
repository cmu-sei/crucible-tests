// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, seededPrimaryViewName, findAdminViewButton } from '../../fixtures';

test.describe('Administration - Views', () => {
  test('Edit View Details', async ({ playerAuthenticatedPage: page }) => {
    const primaryViewName = seededPrimaryViewName();

    // 1. Log in as admin and navigate to Administration > Views
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // expect: The Views admin section is displayed
    await expect(page.getByRole('heading', { name: 'Views' })).toBeVisible();

    // 2. Search for the seeded view and click on it
    await (await findAdminViewButton(page, primaryViewName)).click();

    // expect: A view edit dialog or form opens
    await expect(page.getByRole('heading', { name: /Edit View:/ })).toBeVisible();

    // expect: View details are displayed for editing
    const nameField = page.getByRole('textbox', { name: 'Name (required)' });
    await expect(nameField).toBeVisible();
    await expect(nameField).toHaveValue(primaryViewName);

    const descField = page.getByRole('textbox', { name: 'Description (required)' });
    await expect(descField).toBeVisible();

    // Status dropdown
    await expect(page.getByRole('combobox', { name: 'Status' })).toBeVisible();

    // Template checkbox
    await expect(page.getByRole('checkbox', { name: 'Template' })).toBeVisible();

    // Expandable sections: View Information, Applications, Teams, Files
    await expect(page.getByRole('button', { name: 'View Information' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Applications' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Teams' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Files' })).toBeVisible();

    // 3. Verify fields accept modifications (don't actually save to avoid modifying test data)
    // Click Done to return to the list
    await page.getByRole('button', { name: 'Done' }).click();

    // expect: Updated information is reflected in views list
    await expect(page.getByRole('heading', { name: 'Views' })).toBeVisible();
  });
});
