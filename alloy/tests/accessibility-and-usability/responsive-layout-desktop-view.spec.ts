// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Accessibility and Usability', () => {
  test('Responsive Layout - Desktop View', async ({ page }) => {
    // 1. View application in standard desktop resolution (1920x1080)
    await page.setViewportSize({ width: 1920, height: 1080 });
    await authenticateWithKeycloak(page, Services.Alloy.UI);

    // expect: Page layout utilizes desktop space effectively
    await expect(page.getByText('My Events')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Alloy' })).toBeVisible();

    // 2. Navigate to admin section
    await page.goto(`${Services.Alloy.UI}/admin`);

    // expect: Layout shows sidebar and main content properly
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Event Templates' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    // 3. Resize window to smaller width
    await page.setViewportSize({ width: 1280, height: 720 });

    // expect: Layout adapts smoothly to different window sizes
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });
});
