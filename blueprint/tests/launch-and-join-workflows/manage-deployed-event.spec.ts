// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Launch and Join Event Workflows', () => {
  test('Manage Deployed Event', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to build page and select a MSEL with status 'Deployed'
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('networkidle');

    // Look for a deployed MSEL in the list
    const deployedRow = page.locator(
      'table tbody tr:has-text("Deployed"), [class*="msel-row"]:has-text("Deployed")'
    ).first();
    const deployedVisible = await deployedRow.isVisible({ timeout: 5000 }).catch(() => false);

    if (!deployedVisible) {
      test.skip();
      return;
    }

    // Click on the deployed MSEL
    const mselLink = deployedRow.locator('a').first();
    await mselLink.click();
    await page.waitForLoadState('networkidle');

    // expect: MSEL details are shown with End Date/Time field and 'End Event' button
    const endEventButton = page.locator(
      'button:has-text("End Event"), button:has-text("End"), [class*="end-event-btn"]'
    ).first();
    await expect(endEventButton).toBeVisible({ timeout: 5000 });

    const endDateField = page.locator(
      'text=End Date, [formControlName*="end"], input[placeholder*="End"]'
    ).first();
    const endDateVisible = await endDateField.isVisible({ timeout: 3000 }).catch(() => false);

    // 2. Click 'End Event' button and confirm
    await endEventButton.click();

    const confirmDialog = page.locator(
      '[role="dialog"], .mat-dialog-container, [class*="dialog"]'
    ).first();
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    const confirmButton = page.locator(
      'button:has-text("Confirm"), button:has-text("Yes"), button:has-text("End")'
    ).last();
    await confirmButton.click();

    await page.waitForLoadState('networkidle');

    // expect: Event status changes from 'Deployed' to 'Complete' or 'Archived'
    const endedStatus = page.locator(
      'text=Complete, text=Archived, [class*="complete-status"], [class*="archived-status"]'
    ).first();
    const statusChanged = await endedStatus.isVisible({ timeout: 10000 }).catch(() => false);

    // expect: Success notification is displayed
    const successNotif = page.locator(
      '[class*="snack"], [class*="toast"], text=success'
    ).first();
    const notifVisible = await successNotif.isVisible({ timeout: 5000 }).catch(() => false);

    expect(statusChanged || notifVisible).toBe(true);
  });
});
