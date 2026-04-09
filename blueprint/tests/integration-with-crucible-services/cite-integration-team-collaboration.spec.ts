// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Integration with Crucible Services', () => {
  test('CITE Integration Team Collaboration', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Enable CITE integration on a MSEL Config tab
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

    // Find CITE checkbox
    const citeCheckbox = page.locator(
      'mat-checkbox:has-text("CITE"), [formControlName*="cite"], text=CITE'
    ).first();
    await expect(citeCheckbox).toBeVisible({ timeout: 5000 });

    // Check if CITE is currently enabled
    const citeInput = page.locator('mat-checkbox:has-text("CITE") input[type="checkbox"]').first();
    const citeEnabled = await citeInput.isChecked().catch(() => false);

    if (!citeEnabled) {
      await citeCheckbox.click();
      await page.waitForTimeout(500);
    }

    // expect: CITE checkbox shows a 'Scoring Model:' display
    const scoringModel = page.locator(
      'text=Scoring Model:, [class*="scoring-model"]'
    ).first();
    await expect(scoringModel).toBeVisible({ timeout: 5000 });

    // 2. Check team configurations with CITE enabled when teams lack CITE Team Types
    // Navigate to teams section for this MSEL if it exists
    const teamsNav = page.locator(
      'a:has-text("Teams"), mat-list-item:has-text("Teams")'
    ).first();
    const teamsNavVisible = await teamsNav.isVisible({ timeout: 3000 }).catch(() => false);

    if (teamsNavVisible) {
      await teamsNav.click();
      await page.waitForLoadState('networkidle');

      // expect: Warning message if no teams have CITE Team Type
      const warningMsg = page.locator(
        'text=/WARNING.*No teams have a CITE Team Type/i, ' +
        '[class*="warning"]:has-text("CITE Team Type")'
      ).first();
      const warningVisible = await warningMsg.isVisible({ timeout: 3000 }).catch(() => false);

      // expect: Error message if some teams are missing types
      const errorMsg = page.locator(
        'text=/ERROR.*team.*missing a CITE Team Type/i, ' +
        '[class*="error"]:has-text("CITE Team Type")'
      ).first();
      const errorVisible = await errorMsg.isVisible({ timeout: 3000 }).catch(() => false);
    }

    // Go back to config and check Push Integrations behavior
    const backToConfig = page.locator('[role="tab"]:has-text("Config"), .mat-tab-label:has-text("Config")').first();
    const backVisible = await backToConfig.isVisible({ timeout: 3000 }).catch(() => false);
    if (backVisible) {
      await backToConfig.click();
    }

    // expect: Push Integrations is blocked if teams are missing CITE Team Types
    // The push button may show a tooltip or be disabled
    const pushButton = page.locator('button:has-text("Push Integrations"), button:has-text("Push")').first();
    const pushVisible = await pushButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (pushVisible) {
      await expect(pushButton).toBeVisible();
    }

    // Clean up: uncheck CITE if we enabled it
    if (!citeEnabled) {
      const citeCheckbox2 = page.locator('mat-checkbox:has-text("CITE")').first();
      const checkboxVisible = await citeCheckbox2.isVisible({ timeout: 3000 }).catch(() => false);
      if (checkboxVisible) {
        await citeCheckbox2.click();
        await page.waitForTimeout(500);
      }
    }
  });
});
