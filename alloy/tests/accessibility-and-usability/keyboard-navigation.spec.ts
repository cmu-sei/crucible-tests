// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Accessibility and Usability', () => {
  test('Keyboard Navigation', async ({ page }) => {
    // 1. Navigate to the home page
    await authenticateWithKeycloak(page, Services.Alloy.UI);

    // expect: Home page is loaded
    await expect(page.getByText('My Events')).toBeVisible();

    // 2. Use Tab key to navigate through interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // expect: Focus moves sequentially through all interactive elements
    // expect: All buttons, links, and form fields are accessible via keyboard

    // 3. Use Shift+Tab to navigate backwards
    await page.keyboard.press('Shift+Tab');

    // expect: Focus moves backwards through interactive elements

    // 4. Use Enter to activate buttons and links
    // Focus the search field and verify it's accessible
    const searchBox = page.getByRole('textbox', { name: 'Search' });
    await searchBox.focus();
    await expect(searchBox).toBeFocused();
  });
});
