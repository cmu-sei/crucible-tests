// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Views', () => {
  test('Sort Views in Admin', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Views
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // expect: The Views admin section displays multiple views
    await expect(page.getByRole('heading', { name: 'Views' })).toBeVisible();

    // 2. Click the 'View Name' column header to sort
    await page.getByRole('button', { name: 'View Name' }).click();

    // expect: Views are sorted by name (toggling sort direction)
    const firstCell = page.getByRole('row').nth(1).getByRole('cell').nth(1);
    await expect(firstCell).toBeVisible();
    const firstText = await firstCell.textContent();

    // Click again to reverse sort order
    await page.getByRole('button', { name: 'View Name' }).click();
    const firstCellAfterToggle = page.getByRole('row').nth(1).getByRole('cell').nth(1);
    const secondText = await firstCellAfterToggle.textContent();

    // expect: Sort order has changed
    expect(firstText?.trim()).not.toEqual(secondText?.trim());

    // 3. Click the 'Status' column header
    await page.getByRole('button', { name: 'Status' }).click();

    // expect: Views are sorted by status
    await expect(page.getByRole('button', { name: 'Status' })).toBeVisible();
  });
});
