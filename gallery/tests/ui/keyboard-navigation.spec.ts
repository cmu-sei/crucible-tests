// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Responsive Design and Accessibility', () => {
  test('Keyboard Navigation', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);

    // 1. Navigate the application using Tab, Enter, and Escape keys
    // Tab through the top navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // expect: All interactive elements are reachable via keyboard
    // expect: Focus indicators are visible

    // Test that Enter activates buttons
    await page.getByRole('button', { name: 'Admin User' }).focus();
    await page.keyboard.press('Enter');

    // expect: Menu opens
    await expect(page.getByRole('menuitem', { name: 'Administration' })).toBeVisible();

    // expect: Dialogs can be closed with Escape
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem', { name: 'Administration' })).not.toBeVisible();
  });
});
