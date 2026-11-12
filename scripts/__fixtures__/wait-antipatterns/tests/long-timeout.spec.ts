// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test, expect } from '@playwright/test';

test('test with long timeout', async ({ page }) => {
  await page.goto('https://example.com');
  const element = page.locator('h1');
  await element.waitFor({ timeout: 60000 });
  await expect(element).toBeVisible();
});

test('test with setTimeout', async ({ page }) => {
  test.setTimeout(400000);
  await page.goto('https://example.com');
  const heading = page.locator('h1');
  await expect(heading).toBeVisible();
});
