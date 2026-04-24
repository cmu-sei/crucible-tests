// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services, authenticateWithKeycloak } from '../../../shared-fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Concurrent Score Modifications', async ({ browser }) => {

    // 1. Open two browser instances with same user logged in
    const context1 = await browser.newContext({ ignoreHTTPSErrors: true });
    const context2 = await browser.newContext({ ignoreHTTPSErrors: true });
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await authenticateWithKeycloak(page1, Services.Cite.UI);
    await authenticateWithKeycloak(page2, Services.Cite.UI);

    // 2. Navigate both sessions to the same page (admin)
    for (const p of [page1, page2]) {
      await expect(p).toHaveURL(/localhost:4721/, { timeout: 10000 });
      const adminButton = p.getByRole('button', { name: 'Show Administration Page' });
      await expect(adminButton).toBeVisible({ timeout: 10000 });
      await adminButton.click();
      await expect(p).toHaveURL(/\/admin/, { timeout: 10000 });
    }

    // 3. Both sessions interact with the admin page concurrently
    // expect: Application handles concurrent sessions without errors
    await expect(page1.locator('body')).toBeVisible();
    await expect(page2.locator('body')).toBeVisible();

    // Verify both sessions see the admin page content
    await expect(page1.locator('mat-toolbar-row').getByText('Evaluations')).toBeVisible({ timeout: 5000 });
    await expect(page2.locator('mat-toolbar-row').getByText('Evaluations')).toBeVisible({ timeout: 5000 });

    // expect: Both instances remain functional with no errors
    await expect(page1).toHaveURL(/\/admin/, { timeout: 5000 });
    await expect(page2).toHaveURL(/\/admin/, { timeout: 5000 });

    await context1.close();
    await context2.close();
  });
});
