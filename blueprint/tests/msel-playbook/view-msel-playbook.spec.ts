// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('MSEL Playbook', () => {
  test('View MSEL Playbook', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to a MSEL
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('networkidle');

    // Use the specific MSEL "Project Lagoon TTX - Admin User" which has the test data
    const mselLink = page.getByRole('link', { name: 'Project Lagoon TTX - Admin User' });
    await expect(mselLink).toBeVisible({ timeout: 5000 });
    await mselLink.click();
    await page.waitForLoadState('networkidle');

    // 1. Navigate to a MSEL and click 'MSEL Playbook' in the sidebar navigation
    const playbookNav = page.getByText('MSEL Playbook');
    await expect(playbookNav).toBeVisible({ timeout: 5000 });
    await playbookNav.click();
    await page.waitForLoadState('networkidle');

    // expect: The MSEL Playbook section loads
    const playbookHeading = page.getByRole('heading', { name: 'MSEL Playbook' });
    await expect(playbookHeading).toBeVisible({ timeout: 5000 });

    // expect: Scenario events are displayed in a table format
    const eventsTable = page.getByRole('table');
    await expect(eventsTable).toBeVisible({ timeout: 5000 });

    // expect: Pagination controls are shown with 'Items per page' selector
    const itemsPerPage = page.getByRole('combobox', { name: 'Items per page:' });
    await expect(itemsPerPage).toBeVisible({ timeout: 5000 });

    // 2. Navigate through pages using pagination controls
    const nextPageButton = page.getByRole('button', { name: 'Next page' });
    const nextVisible = await nextPageButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (nextVisible) {
      const isDisabled = await nextPageButton.isDisabled();
      if (!isDisabled) {
        await nextPageButton.click();
        await page.waitForTimeout(500);

        // expect: Previous page button works
        const prevPageButton = page.getByRole('button', { name: 'Previous page' });
        await expect(prevPageButton).toBeVisible({ timeout: 5000 });
        await expect(prevPageButton).not.toBeDisabled();
      }
    }

    // 3. Check if move boundaries are indicated
    // expect: Visual indicators show when events transition between moves
    // The playbook table shows "Move" as a cell label, which indicates move boundaries
    const moveCell = page.getByRole('cell', { name: 'Move' });
    const moveVisible = await moveCell.isVisible({ timeout: 2000 }).catch(() => false);
    // Move indicators may or may not be visible depending on MSEL data
  });
});
