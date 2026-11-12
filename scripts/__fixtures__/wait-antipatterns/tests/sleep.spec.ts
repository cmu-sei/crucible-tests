// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test } from '@playwright/test';

test('test with fixed sleep', async ({ page }) => {
  await page.goto('https://example.com');
  await page.waitForTimeout(500);
});

test('test with networkidle', async ({ page }) => {
  await page.goto('https://example.com', { waitUntil: 'networkidle' });
});
