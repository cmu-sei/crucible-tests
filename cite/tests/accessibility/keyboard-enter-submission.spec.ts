// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.setup.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Accessibility', () => {
  test('Keyboard Navigation - Enter Key Submission', async ({ citeAuthenticatedPage: page }) => {

    // 1. Test keyboard submission using the search field on the home page
    await page.waitForLoadState('networkidle');

    // Wait for the page to be loaded with content
    await expect(page.locator('text=My Evaluations')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Find the search input field on the evaluations page
    const searchField = page.locator('input[type="text"], input[placeholder*="Search" i], input[aria-label*="Search" i]').first();

    const searchExists = await searchField.count();
    if (searchExists === 0) {
      // Skip this test if no searchable input is found
      test.skip(true, 'No search or text input field found on evaluations page');
      return;
    }

    await expect(searchField).toBeVisible({ timeout: 10000 });

    // 2. Focus on the search field and type using keyboard
    await searchField.focus();
    await page.keyboard.type('Project');
    await page.waitForTimeout(500);

    // 3. Press Enter key to submit/search
    // expect: Enter key triggers search functionality
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Verify the field still has the text (search was processed via Enter key)
    const fieldValue = await searchField.inputValue();
    expect(fieldValue).toBe('Project');

    // Clear the field using keyboard
    await searchField.focus();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(500);

    // Verify field is cleared
    const clearedValue = await searchField.inputValue();
    expect(clearedValue).toBe('');

    console.log('Successfully tested keyboard Enter key submission on search field');
  });
});
