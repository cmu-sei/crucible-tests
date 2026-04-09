// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Evaluations', () => {
  test('Delete Evaluation', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to admin evaluations section
    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const evaluationsLink = page.locator('text=Evaluations, a:has-text("Evaluations"), mat-list-item:has-text("Evaluations")').first();
    await expect(evaluationsLink).toBeVisible({ timeout: 10000 });
    await evaluationsLink.click();

    // expect: Evaluations list displays
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    // 2. Click delete button (trash icon) for a test evaluation
    const deleteButton = page.locator('button:has(mat-icon:has-text("delete")), button[aria-label*="delete"]').first();
    await expect(deleteButton).toBeVisible({ timeout: 5000 });
    await deleteButton.click();

    // expect: Confirmation dialog appears
    const confirmDialog = page.locator('mat-dialog-container, [role="dialog"], [class*="confirm"]').first();
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    // 3. Click 'Cancel' in confirmation dialog
    const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("No")').first();
    await cancelButton.click();

    // expect: Dialog closes
    await expect(confirmDialog).not.toBeVisible({ timeout: 5000 });

    // 4. Click delete button again
    await deleteButton.click();

    // expect: Confirmation dialog appears
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    // 5. Click 'Confirm' or 'Delete' in dialog
    const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes")').first();
    await confirmButton.click();

    // expect: Evaluation is deleted successfully
    await page.waitForLoadState('domcontentloaded');
  });
});
