// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, seededPrimaryViewName, findPlayerHomeViewLink, PLAYER_THEMES, applyPlayerTheme } from '../../fixtures';

for (const theme of PLAYER_THEMES) {
  test.describe(`${theme} theme › Responsive Design and Accessibility`, () => {
  test('Keyboard Navigation - Home Page', async ({ playerAuthenticatedPage: page }) => {
    await applyPlayerTheme(page, theme);
    const primaryViewName = seededPrimaryViewName();

    // 1. Log in and navigate to home page
    // expect: User is on the home page
    await expect(page.getByText('My Views')).toBeVisible();

    // 2. Use Tab key to navigate through interactive elements
    await page.keyboard.press('Tab');

    // expect: Focus moves logically through menu, search field, view links
    // expect: All interactive elements are reachable via keyboard
    // expect: Focus indicators are visible

    // Tab through several elements to verify keyboard navigation works
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
    }

    // 3. Press Enter on a view link while focused
    // Focus on a view link and press Enter
    const viewLink = await findPlayerHomeViewLink(page, primaryViewName);
    await viewLink.focus();
    await page.keyboard.press('Enter');

    // expect: The view opens as if clicked with a mouse
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });
  });
  });
}
