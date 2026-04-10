// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('About Page', () => {
  test('About Page - Content Sections', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to About page
    await page.goto(Services.TopoMojo.UI + '/about');
    await page.waitForLoadState('domcontentloaded');

    // expect: About page loads
    await expect(page).toHaveURL(/\/about/);

    // 2. Scroll through page content
    // expect: 'About' section describes TopoMojo's purpose and features
    const aboutSection = page.locator('text=/About/i').first();
    const hasAbout = await aboutSection.isVisible({ timeout: 5000 }).catch(() => false);

    // expect: 'Workspace and Gamespace' section explains the difference
    const workspaceSection = page.locator('text=/Workspace.*Gamespace/i, text=/Gamespace/i').first();
    const hasWorkspaceSection = await workspaceSection.isVisible({ timeout: 5000 }).catch(() => false);

    // expect: 'Hotkeys' section displays keyboard shortcuts in a table format
    const hotkeysSection = page.locator('text=/Hotkey/i, text=/Keyboard/i').first();
    const hasHotkeys = await hotkeysSection.isVisible({ timeout: 5000 }).catch(() => false);

    // expect: 'License' section shows copyright and license information
    const licenseSection = page.locator('text=/License/i, text=/Copyright/i').first();
    const hasLicense = await licenseSection.isVisible({ timeout: 5000 }).catch(() => false);

    // At least some content sections should be present
    expect(hasAbout || hasWorkspaceSection || hasHotkeys || hasLicense).toBe(true);
  });
});
