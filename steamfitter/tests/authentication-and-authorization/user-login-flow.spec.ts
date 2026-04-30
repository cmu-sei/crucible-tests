// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services } from '../../fixtures';

test.describe('Authentication and Authorization', () => {
  test('User Login Flow', async ({ page }) => {
    await page.goto(Services.Steamfitter.UI);

    const keycloakHost = new URL(Services.Keycloak).host;
    await page.waitForURL((url) => url.host === keycloakHost || url.toString().includes('/realms/crucible'), { timeout: 180000 });
    await expect(page.locator('input[name="username"]')).toBeVisible({ timeout: 30000 });

    await page.fill('input[name="username"]', 'admin');
    await expect(page.locator('input[name="username"]')).toHaveValue('admin');

    await page.fill('input[name="password"]', 'admin');

    await page.click('button:has-text("Sign In")');

    const appHost = new URL(Services.Steamfitter.UI).host;
    await page.waitForURL((url) => url.host === appHost, { timeout: 30000 });

    const topbar = page.locator('mat-toolbar, [class*="topbar"], header, [role="banner"]').first();
    await expect(topbar).toBeVisible({ timeout: 15000 });

    await expect(topbar).toContainText(/admin/i);
    await expect(topbar).toContainText(/Steamfitter/i);

    const topbarBg = await topbar.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(topbarBg).toBeTruthy();
  });
});
