// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('About Page', () => {
  test('About Page - License Information', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to About page and locate License section
    await page.goto(Services.TopoMojo.UI + '/about');
    await page.waitForLoadState('domcontentloaded');

    // expect: License section is visible
    const licenseHeading = page.getByRole('heading', { name: 'License' });
    await expect(licenseHeading).toBeVisible({ timeout: 10000 });

    // 2. Review license information
    // expect: Copyright notice displays
    const copyrightNotice = page.getByText(/©.*Carnegie Mellon University.*All Rights Reserved/i);
    await expect(copyrightNotice).toBeVisible();

    // expect: License summary describes redistribution terms
    const licenseSummary = page.getByText(/Redistribution and use in source and binary forms/i);
    await expect(licenseSummary).toBeVisible();
  });
});
