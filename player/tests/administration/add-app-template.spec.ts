// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Application Templates', () => {
  test('Add New Application Template', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Application Templates
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Application Templates' }).click();

    // expect: The Application Templates section is displayed
    await expect(page.getByRole('columnheader', { name: 'Template Name' })).toBeVisible();

    // 2. Click the add button (+ icon, mdi-plus)
    const addButton = page.locator('button:has(mat-icon.mdi-plus)');
    await expect(addButton).toBeVisible();
    await addButton.click();

    // expect: A form or dialog opens to create a new application template
    // expect: Fields for template name, icon, and URL are available
    // The + button auto-creates a "New Template" entry with an expanded edit form
    await expect(page.getByRole('textbox', { name: 'Name' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('textbox', { name: 'URL' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Icon Path' })).toBeVisible();

    // Cleanup: Delete the newly created template via the visible Delete button in the expanded row
    await page.getByRole('button', { name: 'Delete Application Template' }).click();
    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });
    await confirmDialog.getByRole('button', { name: 'YES' }).click();
    await expect(confirmDialog).not.toBeVisible();
  });
});
