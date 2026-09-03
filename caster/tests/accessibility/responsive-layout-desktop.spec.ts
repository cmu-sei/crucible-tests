// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Accessibility and Usability', () => {
  test('Responsive Layout - Desktop View', async ({ casterAuthenticatedPage: page }) => {

    await expect(page.getByText('My Projects')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    // Resize to a smaller desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.getByText('My Projects')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.getByText('My Projects')).toBeVisible();
  });
});
