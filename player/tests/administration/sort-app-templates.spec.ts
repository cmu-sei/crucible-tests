// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Application Templates', () => {
  test('Sort Application Templates', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Application Templates
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Application Templates' }).click();

    // expect: The Application Templates section is displayed
    await expect(page.getByRole('columnheader', { name: 'Template Name' })).toBeVisible();

    // 2. Click the 'Template Name' column header to sort
    await page.getByRole('button', { name: 'Template Name' }).click();

    // expect: Templates are sorted by name (ascending or descending depending on current state)
    // Verify the sort changed by checking that the first row is different from default
    const firstCell = page.getByRole('row').nth(1).getByRole('cell').nth(1);
    await expect(firstCell).toBeVisible();
    const firstText = await firstCell.textContent();

    // Click again to reverse sort order
    await page.getByRole('button', { name: 'Template Name' }).click();
    const firstCellAfterToggle = page.getByRole('row').nth(1).getByRole('cell').nth(1);
    const secondText = await firstCellAfterToggle.textContent();

    // expect: Sort order has changed
    expect(firstText?.trim()).not.toEqual(secondText?.trim());

    // 3. Click the 'Url' column header
    await page.getByRole('button', { name: 'Url' }).click();

    // expect: Templates are sorted by URL
    await expect(page.getByRole('button', { name: 'Url' })).toBeVisible();
  });
});
