// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Application Templates', () => {
  test('Paginate Application Templates', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Application Templates
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Application Templates' }).click();

    // expect: The Application Templates section is displayed with pagination controls
    await expect(page.getByRole('columnheader', { name: 'Template Name' })).toBeVisible();

    // 2. Observe the pagination section
    // expect: Shows pagination status indicating the current page range (e.g., '1 – N of N')
    await expect(page.getByText(/1 – \d+ of \d+/)).toBeVisible();

    // expect: Shows 'Items per page' dropdown
    await expect(page.getByRole('combobox', { name: 'Items per page:' })).toBeVisible();

    // expect: Shows First, Previous, Next, Last page buttons
    await expect(page.getByRole('button', { name: 'First page' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous page' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next page' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Last page' })).toBeVisible();
  });
});
