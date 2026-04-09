// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('MSEL Info Pages Management', () => {
  test('Push and Pull Integrations', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to a MSEL Config tab
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('networkidle');

    const mselLink = page.getByRole('link', { name: /Project Lagoon TTX/ }).first();
    await expect(mselLink).toBeVisible({ timeout: 10000 });
    await mselLink.click();
    await expect(page).toHaveURL(/.*\/build\?msel=.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // 1. Verify Applications to Integrate section is visible with checkboxes
    const playerCheckbox = page.getByRole('checkbox', { name: 'Player' });
    await expect(playerCheckbox).toBeVisible({ timeout: 5000 });

    // expect: 'Remove Integrations' button is visible
    const removeButton = page.getByRole('button', { name: 'Remove Integrations' });
    await expect(removeButton).toBeVisible({ timeout: 5000 });

    // 2. Verify integration checkboxes are checked for this MSEL
    await expect(playerCheckbox).toBeChecked();

    const galleryCheckbox = page.getByRole('checkbox', { name: 'Gallery' });
    await expect(galleryCheckbox).toBeChecked();

    const citeCheckbox = page.getByRole('checkbox', { name: 'CITE' });
    await expect(citeCheckbox).toBeChecked();

    const steamfitterCheckbox = page.getByRole('checkbox', { name: 'Steamfitter' });
    await expect(steamfitterCheckbox).toBeChecked();
  });
});
