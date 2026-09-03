// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Accessibility and Usability', () => {
  test('Responsive Layout - Mobile View', async ({ page }) => {

    await page.setViewportSize({ width: 375, height: 667 });
    // Use raw auth since we need viewport set before auth
    const { authenticateWithKeycloak } = await import('../../../shared-fixtures');
    await authenticateWithKeycloak(page, Services.Caster.UI);

    await expect(page.getByText('Caster').first()).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });
});
