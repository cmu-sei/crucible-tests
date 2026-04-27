// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services } from '../../fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Error Handling and Edge Cases', () => {
  test('Deep Link Access', async ({ page }) => {
    // 1. Copy a deep link URL (e.g., /view/:id)
    const deepLinkUrl = `${Services.Player.UI}/view/35d24422-5c69-4859-bb10-da240fe89902`;

    // 2. Navigate to deep link URL (unauthenticated via storageState override)
    await page.goto(deepLinkUrl);

    // expect: User is redirected to login
    await page.getByText('Sign in to your account').first().waitFor({ state: 'visible', timeout: 70000 });
    await expect(page).toHaveURL(/localhost:8443/);

    // 3. After login, user is redirected back to intended deep link
    await page.getByRole('textbox', { name: 'Username or email' }).fill('admin');
    await page.getByRole('textbox', { name: 'Password' }).fill('admin');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // expect: After login, user is redirected back to intended deep link
    await page.waitForURL(/localhost:4301/, { timeout: 30000 });
  });
});
