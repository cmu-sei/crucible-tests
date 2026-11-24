// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, CASTER_THEMES, setCasterTheme } from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Accessibility and Usability`, () => {
    // The mobile viewport applies when the page is created, so the authenticated
    // fixture (saved Caster session + shell signal) already loads at phone width.
    test.use({ viewport: { width: 375, height: 667 } });

    test('Responsive Layout - Mobile View', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      await expect(page.getByText('Caster').first()).toBeVisible();
      await expect(page.getByRole('table')).toBeVisible();
    });
  });
}
