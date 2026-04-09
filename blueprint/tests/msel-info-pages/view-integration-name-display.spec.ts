// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('MSEL Info Pages Management', () => {
  test('View Integration Name Display', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to a MSEL Config tab with deployed integrations
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('networkidle');

    const mselLink = page.getByRole('link', { name: /Project Lagoon TTX/ }).first();
    await expect(mselLink).toBeVisible({ timeout: 10000 });
    await mselLink.click();
    await expect(page).toHaveURL(/.*\/build\?msel=.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // 1. Verify Player integration is enabled and shows View ID
    const playerCheckbox = page.getByRole('checkbox', { name: 'Player' });
    await expect(playerCheckbox).toBeVisible({ timeout: 5000 });
    await expect(playerCheckbox).toBeChecked();

    // expect: Player View ID is displayed
    const playerViewLabel = page.getByText('View:');
    await expect(playerViewLabel.first()).toBeVisible({ timeout: 5000 });

    // expect: "Open in Player" link is visible
    const openInPlayerLink = page.getByRole('link', { name: 'Open in Player' });
    await expect(openInPlayerLink).toBeVisible({ timeout: 5000 });

    // 2. Verify Gallery integration shows Collection and Exhibit IDs
    const galleryCheckbox = page.getByRole('checkbox', { name: 'Gallery' });
    await expect(galleryCheckbox).toBeChecked();

    const collectionLabel = page.getByText('Collection:');
    await expect(collectionLabel.first()).toBeVisible({ timeout: 5000 });

    const exhibitLabel = page.getByText('Exhibit:');
    await expect(exhibitLabel.first()).toBeVisible({ timeout: 5000 });

    const openInGalleryLink = page.getByRole('link', { name: 'Open in Gallery' });
    await expect(openInGalleryLink).toBeVisible({ timeout: 5000 });

    // 3. Verify CITE integration shows Scoring Model and Evaluation IDs
    const citeCheckbox = page.getByRole('checkbox', { name: 'CITE' });
    await expect(citeCheckbox).toBeChecked();

    const scoringModelLabel = page.getByText('Scoring Model:');
    await expect(scoringModelLabel.first()).toBeVisible({ timeout: 5000 });

    const evaluationLabel = page.getByText('Evaluation:');
    await expect(evaluationLabel.first()).toBeVisible({ timeout: 5000 });

    const openInCiteLink = page.getByRole('link', { name: 'Open in CITE' });
    await expect(openInCiteLink).toBeVisible({ timeout: 5000 });

    // 4. Verify Steamfitter integration is enabled
    const steamfitterCheckbox = page.getByRole('checkbox', { name: 'Steamfitter' });
    await expect(steamfitterCheckbox).toBeChecked();
  });
});
