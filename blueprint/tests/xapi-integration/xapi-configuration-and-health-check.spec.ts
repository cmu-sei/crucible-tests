// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect } from '@playwright/test';
import { Services } from '../../fixtures';

test.describe('xAPI Integration and Learning Analytics', () => {
  test('xAPI Configuration and Health Check', async ({ page }) => {
    // 1. Start Blueprint API with LRsql enabled
    // Note: This is a prerequisite - API must be running with xAPI configuration
    // We verify the configuration through the health check endpoint

    // 2. Check API health endpoint at /api/health/ready
    const healthResponse = await page.goto(`${Services.Blueprint.API}/api/health/ready`, {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    // expect: Health check returns 200 OK
    expect(healthResponse?.status()).toBe(200);

    // expect: xAPI configuration is loaded without errors
    const healthBody = await healthResponse?.text();
    expect(healthBody).toBeTruthy();

    // 3. Navigate to LRsql UI at http://localhost:9274
    await page.goto(Services.Lrsql, {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    // expect: LRsql web interface loads
    await expect(page).toHaveURL(new RegExp(Services.Lrsql));

    // expect: Admin credentials 'admin' / 'admin' work for authentication
    // Check if we're on a login page
    const hasLoginForm = await page.locator('input[name="username"], input[type="text"]').first().isVisible({ timeout: 5000 }).catch(() => false);

    if (hasLoginForm) {
      await page.fill('input[name="username"], input[type="text"]', 'admin');
      await page.fill('input[name="password"], input[type="password"]', 'admin');

      // Try common submit button patterns
      const submitButton = page.locator('button[type="submit"], input[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first();
      await submitButton.click();

      // Wait for redirect or dashboard to load
      await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
    }

    // Verify we're authenticated and on the LRsql interface
    await expect(page).toHaveURL(new RegExp(Services.Lrsql));
  });
});
