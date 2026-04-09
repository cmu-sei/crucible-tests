// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Integration with Crucible Services', () => {
  test('Steamfitter Integration - Scenario Automation', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to Blueprint build page (auth state pre-loaded from setup)
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('networkidle');

    // 1. Open an existing MSEL that has Steamfitter integration
    const mselLink = page.getByRole('link', { name: /Project Lagoon TTX/ }).first();
    await expect(mselLink).toBeVisible({ timeout: 10000 });
    await mselLink.click();
    await expect(page).toHaveURL(/.*\/build\?msel=.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // expect: MSEL Config page is displayed with integrations section
    const steamfitterCheckbox = page.getByRole('checkbox', { name: 'Steamfitter' });
    await expect(steamfitterCheckbox).toBeVisible({ timeout: 10000 });

    // expect: Steamfitter integration is enabled (checked) on this MSEL
    await expect(steamfitterCheckbox).toBeChecked();

    // 2. Verify other integrations are also visible in the Applications to Integrate section
    const playerCheckbox = page.getByRole('checkbox', { name: 'Player' });
    await expect(playerCheckbox).toBeVisible({ timeout: 5000 });

    const galleryCheckbox = page.getByRole('checkbox', { name: 'Gallery' });
    await expect(galleryCheckbox).toBeVisible({ timeout: 5000 });

    const citeCheckbox = page.getByRole('checkbox', { name: 'CITE' });
    await expect(citeCheckbox).toBeVisible({ timeout: 5000 });

    // 3. Verify Scenario Events section exists (where Steamfitter tasks are triggered)
    const scenarioEventsNav = page.locator(
      'a:has-text("Scenario Events"), mat-list-item:has-text("Scenario Events")'
    ).first();
    await expect(scenarioEventsNav).toBeVisible({ timeout: 5000 });
  });
});
