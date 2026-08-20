// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  seededPrimaryViewName,
  findPlayerHomeViewLink,
  clickWithoutOverlayInterference,
} from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Browser Back Button Navigation', async ({ playerAuthenticatedPage: page }) => {
    const primaryViewName = seededPrimaryViewName();

    // 1. Navigate through multiple pages (home -> view -> admin)
    // Start on home page
    await expect(page.getByText('My Views')).toBeVisible();

    // Navigate to a view
    await (await findPlayerHomeViewLink(page, primaryViewName)).click();
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });

    // Navigate to admin through the in-app menu so browser history matches real user flow
    await clickWithoutOverlayInterference(page, page.getByRole('button', { name: 'Menu' }));
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // expect: Navigation history is recorded

    // 2. Click browser back button
    await page.goBack();
    await page.waitForLoadState('load');

    // expect: User navigates back to previous page
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });

    // expect: Page state is preserved or reloaded correctly
    // expect: No errors occur
    await page.goBack();
    await page.waitForLoadState('load');
    await expect(page.getByText('My Views')).toBeVisible({ timeout: 10000 });
  });
});
