// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Home Page and Evaluation List', () => {
  test('Evaluation List Display - With Evaluations', async ({ citeAuthenticatedPage: page }) => {

    // 1. Log in as user with access to evaluations
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });

    // expect: Evaluation list table displays
    const table = page.locator('mat-table, table, [class*="evaluation-list"]').first();
    await expect(table).toBeVisible({ timeout: 10000 });

    // expect: Table shows columns for 'Name', 'Status', 'Created By', and 'Date Created'
    const nameColumn = page.locator('th:has-text("Name"), mat-header-cell:has-text("Name"), [class*="header"]:has-text("Name")').first();
    await expect(nameColumn).toBeVisible({ timeout: 5000 });

    const statusColumn = page.locator('th:has-text("Status"), mat-header-cell:has-text("Status"), [class*="header"]:has-text("Status")').first();
    await expect(statusColumn).toBeVisible({ timeout: 5000 });

    // expect: Active evaluations are visible in the list
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
  });
});
