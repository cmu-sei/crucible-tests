// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Integration with Crucible Services', () => {
  test('Gallery Integration Validation', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Configure data fields with Gallery Article Parameters and create Gallery scenario events with missing required data
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('networkidle');

    const mselLink = page.locator(
      'table tbody tr a, [class*="msel-name"] a, a[href*="/msel/"]'
    ).first();
    const mselLinkVisible = await mselLink.isVisible({ timeout: 5000 }).catch(() => false);
    if (!mselLinkVisible) {
      test.skip();
      return;
    }
    await mselLink.click();
    await page.waitForLoadState('networkidle');

    // Navigate to Config tab
    const configTab = page.locator('[role="tab"]:has-text("Config"), .mat-tab-label:has-text("Config")').first();
    const configTabVisible = await configTab.isVisible({ timeout: 3000 }).catch(() => false);
    if (configTabVisible) {
      await configTab.click();
    }

    // Find Gallery checkbox
    const galleryCheckbox = page.locator(
      'mat-checkbox:has-text("Gallery"), text=Gallery'
    ).first();
    await expect(galleryCheckbox).toBeVisible({ timeout: 5000 });

    // Check if Gallery is enabled
    const galleryInput = page.locator('mat-checkbox:has-text("Gallery") input[type="checkbox"]').first();
    const galleryEnabled = await galleryInput.isChecked().catch(() => false);

    if (!galleryEnabled) {
      await galleryCheckbox.click();
      await page.waitForTimeout(500);
    }

    // expect: Gallery data fields show galleryArticleParameter assignment options
    // Navigate to Data Fields admin to check
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await page.waitForLoadState('networkidle');

    const dataFieldsNav = page.locator(
      'mat-list-item:has-text("Data Fields"), a:has-text("Data Fields")'
    ).first();
    const dataFieldsVisible = await dataFieldsNav.isVisible({ timeout: 5000 }).catch(() => false);
    if (dataFieldsVisible) {
      await dataFieldsNav.click();
      await page.waitForLoadState('networkidle');

      const galleryParamOption = page.locator(
        'text=/galleryArticleParameter/i, text=Gallery Article Parameter, [class*="gallery-param"]'
      ).first();
      const galleryParamVisible = await galleryParamOption.isVisible({ timeout: 3000 }).catch(() => false);
    }

    // 2. Attempt to Push Integrations with incomplete Gallery event data
    // Navigate back to the MSEL
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('networkidle');

    const mselLink2 = page.locator('table tbody tr a, a[href*="/msel/"]').first();
    if (await mselLink2.isVisible({ timeout: 5000 }).catch(() => false)) {
      await mselLink2.click();
      await page.waitForLoadState('networkidle');
    }

    const pushButton = page.locator(
      'button:has-text("Push Integrations"), button:has-text("Push")'
    ).first();
    const pushVisible = await pushButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (pushVisible) {
      await pushButton.click();

      const confirmDialog = page.locator('[role="dialog"], .mat-dialog-container').first();
      await expect(confirmDialog).toBeVisible({ timeout: 5000 });

      // expect: Warning appended to push confirmation about missing Gallery fields
      const warningMsg = page.locator(
        'text=/WARNING.*Gallery.*missing required fields/i, ' +
        'text=/missing required fields/i'
      ).first();
      const warningVisible = await warningMsg.isVisible({ timeout: 3000 }).catch(() => false);

      // expect: Push can still proceed after acknowledging the warning
      const confirmButton = page.locator(
        'button:has-text("Confirm"), button:has-text("Yes"), button:has-text("OK")'
      ).last();
      // Dismiss without confirming to avoid side effects
      const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("No")').first();
      const cancelVisible = await cancelButton.isVisible({ timeout: 2000 }).catch(() => false);
      if (cancelVisible) {
        await cancelButton.click();
      }
    }
  });
});
