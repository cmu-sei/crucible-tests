// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Browser Back Button Navigation', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate through multiple pages (home -> admin)
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });

    // Navigate to the Administration page
    const adminButton = page.getByRole('button', { name: 'Show Administration Page' });
    await expect(adminButton).toBeVisible({ timeout: 10000 });
    await adminButton.click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // expect: Navigation history is recorded

    // 2. Click browser back button
    await page.goBack();

    // expect: User navigates back to previous page
    await expect(page).toHaveURL(/localhost:4721\/$/, { timeout: 10000 });

    // expect: Page state is preserved or reloaded correctly
    // expect: No errors occur
    await expect(page.locator('body')).toBeVisible();
  });
});
