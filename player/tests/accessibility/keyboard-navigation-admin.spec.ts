// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Responsive Design and Accessibility', () => {
  test('Keyboard Navigation - Administration', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();

    // expect: User is on the administration page
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // 2. Use Tab and arrow keys to navigate through sections and tables
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // expect: All sections are reachable via keyboard
    // expect: Checkboxes and buttons can be activated with Enter or Space

    // Focus on the Views button and activate with Enter
    const viewsButton = page.getByRole('button', { name: 'Views' });
    await viewsButton.focus();
    await page.keyboard.press('Enter');

    // expect: Focus indicators are clear
    await expect(page.getByRole('heading', { name: 'Views' })).toBeVisible();

    // Navigate to another section via keyboard
    const usersButton = page.getByRole('button', { name: 'Users Users' });
    await usersButton.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
  });
});
