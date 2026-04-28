// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Accessibility and Usability', () => {
  test('Responsive Layout - Mobile View', async ({ page }) => {
    // 1. Resize browser to mobile viewport (375x667)
    await page.setViewportSize({ width: 375, height: 667 });
    await authenticateWithKeycloak(page, Services.Alloy.UI);

    // expect: Page layout adapts to mobile view
    // expect: All content is accessible
    await expect(page.getByText('My Events')).toBeVisible();

    // 2. Navigate through the application
    await page.goto(`${Services.Alloy.UI}/admin`);

    // expect: Navigation is accessible
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
