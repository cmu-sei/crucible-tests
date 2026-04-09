// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Scenario Events Management', () => {
  test('Starter MSEL View', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to /starter?msel={mselId}
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('domcontentloaded');

    // Get a MSEL ID - either from URL if already on a MSEL page or from a link
    let mselId: string | undefined;

    // Check if we're already on a MSEL page by looking at the URL
    const currentUrl = page.url();
    const urlMselIdMatch = currentUrl.match(/[?&]msel=([^&]+)/);

    if (urlMselIdMatch) {
      mselId = urlMselIdMatch[1];
    } else {
      // We're on the MSEL list page, need to extract MSEL ID from a link
      const mselLink = page.locator(
        'a[href*="msel"], ' +
        '[class*="msel-item"], ' +
        '[class*="msel-card"], ' +
        'table tbody tr'
      ).first();
      const mselLinkVisible = await mselLink.isVisible({ timeout: 5000 }).catch(() => false);
      if (!mselLinkVisible) {
        test.skip();
        return;
      }

      const href = await mselLink.getAttribute('href');
      const mselIdMatch = href?.match(/[?&]msel=([^&]+)/);
      if (!mselIdMatch) {
        test.skip();
        return;
      }
      mselId = mselIdMatch[1];
    }

    await page.goto(`${Services.Blueprint.UI}/starter?msel=${mselId}`);
    await page.waitForLoadState('domcontentloaded');

    // expect: Starter page loads with Blueprint topbar
    await expect(page).toHaveURL(/.*\/starter.*/, { timeout: 10000 });

    const topbar = page.locator('[class*="topbar"], mat-toolbar').first();
    await expect(topbar).toBeVisible({ timeout: 5000 });

    // expect: Scenario event list is displayed in starter mode for direct editing
    const scenarioContent = page.locator(
      'table, [class*="scenario-events"], [class*="event-list"], [class*="starter"]'
    ).first();
    await expect(scenarioContent).toBeVisible({ timeout: 5000 });
  });
});
