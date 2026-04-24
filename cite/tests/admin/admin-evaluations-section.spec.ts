// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

test.describe('Administration - Evaluations', () => {
  test('Evaluations Section Navigation', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to admin page
    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // expect: Evaluations management section displays by default
    // Wait for the evaluations table to load first
    const evaluationsTable = page.locator('table');
    await expect(evaluationsTable).toBeVisible({ timeout: 15000 });

    // expect: Admin page loads with sidebar
    const adminSidebar = page.locator('mat-list-item').filter({ hasText: 'Evaluations' });
    await expect(adminSidebar).toBeVisible({ timeout: 5000 });

    // expect: Search and filter options are available
    const searchField = page.getByRole('textbox', { name: 'Search' });
    await expect(searchField).toBeVisible({ timeout: 5000 });

    // expect: Status filter dropdown is available
    const statusFilter = page.getByRole('combobox', { name: 'Statuses' });
    await expect(statusFilter).toBeVisible({ timeout: 5000 });
  });
});
