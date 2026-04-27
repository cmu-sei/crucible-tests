// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('User Management', () => {
  test('User ID Copy Button', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // Navigate to Users section
    await page.locator('mat-list-item').filter({ hasText: 'Users' }).getByRole('button').click();

    // 1. Click the Copy button (clipboard icon) next to a user's ID
    // The button's accessible name includes the UUID (e.g. "Copy: 9b3b331c-...")
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
    const copyButton = page.getByRole('button', { name: /Copy:/ }).first();
    await expect(copyButton).toBeVisible();

    // Extract the UUID from the button's title attribute (e.g. "Copy:  9b3b331c-...")
    const buttonTitle = await copyButton.getAttribute('title') ?? '';
    expect(buttonTitle).toMatch(uuidPattern);
    const uuid = buttonTitle.match(uuidPattern)![0];

    // Click the copy button to verify it triggers without error
    await copyButton.click();

    // expect: The user's UUID is copied to the clipboard
    // Verify the UUID in the button title matches the UUID displayed in the table cell
    const userRow = page.getByRole('row').filter({ hasText: uuid });
    await expect(userRow.getByRole('cell').first()).toContainText(uuid);
  });
});
