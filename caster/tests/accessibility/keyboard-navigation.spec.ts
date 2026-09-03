// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Accessibility and Usability', () => {
  test('Keyboard Navigation', async ({ casterAuthenticatedPage: page }) => {

    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();

    // 2. Use Tab key to navigate
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus').first()).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(page.locator(':focus').first()).toBeVisible();

    // 3. Use Shift+Tab to navigate backwards
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator(':focus').first()).toBeVisible();

    // 4. Verify search field works with keyboard
    const searchBox = page.getByRole('textbox', { name: 'Search' });
    await searchBox.focus();
    await expect(searchBox).toBeFocused();
  });
});
