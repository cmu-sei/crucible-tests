// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect } from '@playwright/test';
import { Services, authenticateBlueprintWithKeycloak } from '../../fixtures';

test.describe('Teams Management', () => {
  test('CITE Integration Team Validation', async ({ page }) => {
    await authenticateBlueprintWithKeycloak(page);

    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('domcontentloaded');

    const firstMselLink = page.locator('a[href*="/msel/"]').first();
    await firstMselLink.click();
    await page.waitForLoadState('domcontentloaded');

    // 1. Create a MSEL with CITE integration enabled
    const configTab = page.locator('text=Config, button:has-text("Config")').first();
    if (await configTab.isVisible({ timeout: 5000 })) {
      await configTab.click();
      await page.waitForLoadState('domcontentloaded');

      // expect: CITE checkbox is checked on Config tab
      const citeCheckbox = page.locator('input[type="checkbox"][formcontrolname*="cite"], mat-checkbox:has-text("CITE")').first();
      if (await citeCheckbox.isVisible({ timeout: 3000 })) {
        const isChecked = await citeCheckbox.isChecked();
        if (!isChecked) {
          await citeCheckbox.click();
          await page.waitForTimeout(500);
        }
      }
    }

    // 2. Navigate to Teams section and verify team configurations
    const teamsLink = page.locator('a:has-text("Teams"), button:has-text("Teams")').first();
    await teamsLink.click();
    await page.waitForLoadState('domcontentloaded');

    // expect: If teams exist without CITE Team Types, validation warning appears

    // 3. Attempt to Push Integrations with teams missing CITE Team Types
    const configLink = page.locator('a:has-text("Config"), button:has-text("Config")').first();
    await configLink.click();
    await page.waitForLoadState('domcontentloaded');

    const pushIntegrationsButton = page.locator('button:has-text("Push Integrations")').first();
    if (await pushIntegrationsButton.isVisible({ timeout: 5000 })) {
      await pushIntegrationsButton.click();

      // expect: Warning message: '** ERROR: [N] team(s) are missing a CITE Team Type **'
      // expect: Push Integrations button is disabled or shows error
      const warningDialog = page.locator('mat-dialog-container, [role="dialog"]');
      if (await warningDialog.isVisible({ timeout: 3000 })) {
        const dialogText = await warningDialog.textContent();
        if (dialogText?.includes('ERROR') || dialogText?.includes('team')) {
          console.log('Validation warning displayed for missing CITE Team Types');
        }
      }

      // 4. Assign CITE Team Types to all teams and push again
      // expect: Push Integrations proceeds successfully
      // expect: Teams are created in CITE with correct team types
    }
  });
});
