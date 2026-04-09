// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// Debug test to investigate the import button
import { test, expect, Services } from '../../fixtures';

test('Debug: Check for Import button', async ({ blueprintAuthenticatedPage: page }) => {

  // Navigate to Blueprint
  await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Take a screenshot to see what we have
  await page.screenshot({ path: '/tmp/blueprint-page.png', fullPage: true });

  // Log all buttons on the page
  const allButtons = await page.locator('button').all();
  console.log(`Found ${allButtons.length} buttons on the page`);

  for (let i = 0; i < allButtons.length; i++) {
    const button = allButtons[i];
    const text = await button.innerText().catch(() => '');
    const ariaLabel = await button.getAttribute('aria-label').catch(() => '');
    const classes = await button.getAttribute('class').catch(() => '');
    console.log(`Button ${i}: text="${text}", aria-label="${ariaLabel}", classes="${classes}"`);
  }

  // Check for mat-icon elements that might be import icons
  const icons = await page.locator('mat-icon').all();
  console.log(`Found ${icons.length} mat-icon elements`);

  for (let i = 0; i < icons.length; i++) {
    const icon = icons[i];
    const text = await icon.innerText().catch(() => '');
    const title = await icon.getAttribute('title').catch(() => '');
    console.log(`Icon ${i}: text="${text}", title="${title}"`);
  }

  // Pause for inspection
  await page.pause();
});
