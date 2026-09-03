// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  deleteMsel,
  navigateToMsel,
  tempBlueprintName,
} from '../../test-helpers';
import { request as playwrightRequest } from '@playwright/test';

test.describe('MSEL Info Pages Management', () => {
  let token: string;
  let mselId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();

    // Create a MSEL with integration flags enabled via direct API call
    const ctx = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      const createBody = {
        name: tempBlueprintName('TestBP-MSEL'),
        description: 'Test MSEL with integrations enabled',
        isTemplate: false,
        status: 'Pending',
        usePlayer: true,
        useGallery: true,
        useCite: true,
        useSteamfitter: true,
        startTime: new Date().toISOString(),
        durationSeconds: 3600,
      };

      const res = await ctx.fetch(`${Services.Blueprint.API}/api/msels`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        data: createBody,
      });

      if (!res.ok()) {
        throw new Error(`Failed to create MSEL with integrations: ${res.status()}`);
      }

      const data = await res.json();
      mselId = data.id;
    } finally {
      await ctx.dispose();
    }
  });

  test.afterEach(async () => {
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('View Integration Name Display', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to the seeded MSEL with integrations enabled
    await navigateToMsel(page, mselId);

    // 1. Verify Player integration checkbox is enabled
    const playerCheckbox = page.getByRole('checkbox', { name: 'Player' });
    await expect(playerCheckbox).toBeVisible({ timeout: 5000 });
    await expect(playerCheckbox).toBeChecked();

    // Note: Integration names (View, Collection, Exhibit, etc.) are only displayed
    // after the MSEL has been deployed/pushed to those services. Since we cannot
    // safely push to external services in this test (they may not be available or
    // pushing creates real objects), we verify only the UI contract: checkboxes
    // are checked when the flags are true.

    // 2. Verify Gallery integration checkbox is enabled
    const galleryCheckbox = page.getByRole('checkbox', { name: 'Gallery' });
    await expect(galleryCheckbox).toBeVisible({ timeout: 5000 });
    await expect(galleryCheckbox).toBeChecked();

    // 3. Verify CITE integration checkbox is enabled
    const citeCheckbox = page.getByRole('checkbox', { name: 'CITE' });
    await expect(citeCheckbox).toBeVisible({ timeout: 5000 });
    await expect(citeCheckbox).toBeChecked();

    // 4. Verify Steamfitter integration checkbox is enabled
    const steamfitterCheckbox = page.getByRole('checkbox', { name: 'Steamfitter' });
    await expect(steamfitterCheckbox).toBeVisible({ timeout: 5000 });
    await expect(steamfitterCheckbox).toBeChecked();
  });
});
