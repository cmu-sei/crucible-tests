// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Home Page and Navigation', () => {
  test('Browser Back and Forward Navigation', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to http://localhost:4725 and view the home page
    
    // expect: Home page loads
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');
    
    const homeUrl = page.url();
    
    // 2. Click on a MSEL from the list to view its details
    const mselLink = page.locator(
      'a[href*="msel"], ' +
      '[class*="msel-item"], ' +
      '[class*="msel-card"], ' +
      'table tr td a'
    ).first();
    
    // If MSEL link is available, click it
    if (await mselLink.isVisible({ timeout: 3000 })) {
      await mselLink.click();
      
      // expect: MSEL details page is displayed
      await page.waitForLoadState('domcontentloaded');
      
      // expect: URL changes to include MSEL ID
      const mselUrl = page.url();
      expect(mselUrl).not.toBe(homeUrl);
      expect(mselUrl).toMatch(/msel|detail|view/i);
      
      // 3. Navigate to another section (e.g., Build)
      await page.goto(`${Services.Blueprint.UI}/build`);
      await page.waitForLoadState('domcontentloaded');

      // expect: New section is displayed
      // expect: URL changes accordingly
      const buildUrl = page.url();
      expect(buildUrl).not.toBe(mselUrl);
      expect(buildUrl).toMatch(/build/i);

      // 4. Click browser back button
      await page.goBack();
      await page.waitForLoadState('domcontentloaded');

      // expect: Application navigates back to MSEL details page
      // expect: MSEL details are displayed
      await expect(page).toHaveURL(mselUrl, { timeout: 10000 });

      // 5. Click browser back button again
      await page.goBack();
      await page.waitForLoadState('domcontentloaded');

      // expect: Application navigates back to home page
      // expect: MSEL list is displayed
      await expect(page).toHaveURL(homeUrl, { timeout: 10000 });

      // 6. Click browser forward button
      await page.goForward();
      await page.waitForLoadState('domcontentloaded');

      // expect: Application navigates forward to MSEL details
      // expect: Correct MSEL is displayed
      await expect(page).toHaveURL(mselUrl, { timeout: 10000 });
    } else {
      // If no MSELs exist, create navigation history manually
      await page.goto(`${Services.Blueprint.UI}/build`);
      await page.waitForLoadState('domcontentloaded');
      const buildUrl = page.url();

      await page.goBack();
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(homeUrl, { timeout: 10000 });

      await page.goForward();
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(buildUrl, { timeout: 10000 });
    }
  });
});
