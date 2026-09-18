// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, setCasterTheme, CASTER_THEMES } from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Error Handling and Validation`, () => {
    test('API Error Display', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

    await expect(page.getByText('My Projects')).toBeVisible();

    await page.locator('button[mattooltip="Add New Project"]').click();
    await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();

    await page.getByRole('textbox', { name: 'Name' }).fill('Valid Project');
    await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();

    await page.getByRole('button', { name: 'Cancel' }).click();
    });
});
}
