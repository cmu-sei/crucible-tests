// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test, expect } from '@playwright/test';

// This test used to have page.waitForTimeout(500) but we removed it.
/* Also used to have networkidle in the goto call */
test('comment-only test', async ({ page }) => {
  await page.goto('https://example.com');
  const heading = page.locator('h1');
  await expect(heading).toBeVisible();
});
