// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test } from '@playwright/test';

test('allowed wait', async ({ page }) => {
  await page.goto('https://example.com');
  // allow-wait-antipattern: app has no completion signal for X
  await page.waitForTimeout(500);
});
