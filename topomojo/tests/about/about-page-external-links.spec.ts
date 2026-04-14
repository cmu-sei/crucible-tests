// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('About Page', () => {
  test('About Page - External Links', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to About page
    await page.goto(Services.TopoMojo.UI + '/about');
    await page.waitForLoadState('domcontentloaded');

    // expect: About page loads
    await expect(page).toHaveURL(/\/about/);

    // expect: Resources sidebar is visible if external links are not disabled
    // 2. Observe Resources section in sidebar
    const githubLink = page.locator('a:has-text("Source code"), a:has-text("GitHub"), a[href*="github"]').first();
    const hasGithub = await githubLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasGithub) {
      // expect: 'Source code (GitHub)' link is visible and opens in new tab
      await expect(githubLink).toHaveAttribute('target', '_blank');
    }

    const docsLink = page.locator('a:has-text("Documentation"), a:has-text("Docs")').first();
    const hasDocs = await docsLink.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasDocs) {
      // expect: 'Documentation' link is visible and opens in new tab
      await expect(docsLink).toHaveAttribute('target', '_blank');
    }

    const licenseLink = page.locator('a:has-text("License")').first();
    const hasLicenseLink = await licenseLink.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasLicenseLink) {
      // expect: 'License' link is visible and opens in new tab
      await expect(licenseLink).toHaveAttribute('target', '_blank');
    }
  });
});
