// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services } from '../../fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Error Handling and Edge Cases', () => {
  test('Deep Link Access', async ({ page }) => {

    // 1-2. Navigate to deep link URL without auth
    await page.goto(`${Services.Cite.UI}/?evaluation=test-eval-id`);

    // expect: User is redirected to login
    await expect(page).toHaveURL(/localhost:8443/, { timeout: 70000 });

    // 3. After login, user should be redirected back
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin');
    await page.click('#kc-login');

    // expect: After login, user is redirected back to intended deep link
    await page.waitForURL(/localhost:4721/, { timeout: 30000 });
  });
});
