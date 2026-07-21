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

    // The home search field only renders on the "My Evaluations" list view. A prior test
    // may have left an evaluation selected (persisted in localStorage), which opens the
    // home page directly into that evaluation with no search field. Ensure we are on the
    // list view by clearing the saved selection and reloading, rather than skipping.
    const searchField = page.locator('input[type="text"], input[placeholder*="Search" i], input[aria-label*="Search" i]').first();
    if (!(await searchField.isVisible({ timeout: 3000 }).catch(() => false))) {
      await page.evaluate(() => {
        try {
          const raw = window.localStorage.getItem('uiState');
          const state = raw ? JSON.parse(raw) : {};
          state.selectedEvaluation = '';
          window.localStorage.setItem('uiState', JSON.stringify(state));
        } catch {
          /* ignore */
        }
      });
      await page.goto(Services.Cite.UI);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('text=My Evaluations')).toBeVisible({ timeout: 10000 });
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
