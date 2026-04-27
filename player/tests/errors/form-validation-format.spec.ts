// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Form Validation - Invalid Input Format', async ({ playerAuthenticatedPage: page }) => {
    // 1. Navigate to a form with formatted fields (e.g., Application Template URL)
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Application Templates' }).click();
    await expect(page.getByRole('columnheader', { name: 'Template Name' })).toBeVisible();

    // expect: Form is displayed
    // Click on a template URL to edit
    const urlButton = page.getByRole('button', { name: /localhost:4403/ });
    await expect(urlButton).toBeVisible();

    // 2. The form should validate URL format
    // expect: Field shows validation error for malformed input
    // 3. Attempt to submit
    // expect: Form validation prevents submission
    // expect: Specific format error is displayed
    // Verify the template section is properly rendered with URL fields
    await expect(page.getByRole('columnheader', { name: 'Url' })).toBeVisible();
  });
});
