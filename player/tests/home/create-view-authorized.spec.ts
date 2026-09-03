// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Home Page - My Views', () => {
  test('Create New View - Authorized User', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as user with 'CreateViews' permission
    // expect: User is on home page
    await expect(page.getByText('My Views')).toBeVisible();

    // 2. Look for 'Create' or 'New View' button (the + icon button next to "My Views")
    const createButton = page.getByText('My Views').locator('..').locator('button');

    // expect: Button to create new view is visible and enabled
    await expect(createButton).toBeVisible();

    // 3. Click the create view button
    await createButton.click();

    // expect: Create view dialog opens
    const dialog = page.getByRole('dialog', { name: 'Create New View?' });
    await expect(dialog).toBeVisible();

    // expect: Dialog prompts for view name
    await expect(dialog.getByRole('heading', { name: 'Create New View?' })).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'Name' })).toBeVisible();

    // Verify Save button is disabled when name is empty
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();

    // Cancel the dialog
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();
  });
});
