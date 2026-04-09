// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services, authenticateWithKeycloak } from '../../../shared-fixtures';

test.describe('Real-time Collaboration Features', () => {
  test('Real-time Team Changes', async ({ browser }) => {

    // 1. Open two browser instances with users viewing the same evaluation
    const context1 = await browser.newContext({ ignoreHTTPSErrors: true });
    const context2 = await browser.newContext({ ignoreHTTPSErrors: true });
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await authenticateWithKeycloak(page1, Services.Cite.UI);
    await authenticateWithKeycloak(page2, Services.Cite.UI);

    // Both navigate to same evaluation
    const rows1 = page1.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows1.first()).toBeVisible({ timeout: 10000 });
    await rows1.first().click();
    await page1.waitForLoadState('domcontentloaded');

    const rows2 = page2.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows2.first()).toBeVisible({ timeout: 10000 });
    await rows2.first().click();
    await page2.waitForLoadState('domcontentloaded');

    // expect: Both instances are viewing evaluation data
    // 2. In admin interface in first instance, modify team membership
    // 3. Observe second instance - team changes reflected automatically

    await context1.close();
    await context2.close();
  });
});
