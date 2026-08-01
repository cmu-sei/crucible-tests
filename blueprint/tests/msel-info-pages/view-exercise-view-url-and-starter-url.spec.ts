// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services, serviceUrlPattern } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  navigateToMsel,
} from '../../test-helpers';

test.describe('MSEL Info Pages Management', () => {
  let token: string;
  let mselId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token);
    mselId = msel.id;
  });

  test.afterEach(async () => {
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('View Exercise View URL and Starter URL', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to the seeded MSEL
    await navigateToMsel(page, mselId);

    // 1. Verify Exercise View URL section
    const exerciseViewSection = page.getByText('Exercise View URL');
    await expect(exerciseViewSection).toBeVisible({ timeout: 5000 });

    // expect: Exercise View URL link is visible with correct format
    const exerciseViewLink = page.getByRole('link', { name: serviceUrlPattern(Services.Blueprint.UI) }).first();
    await expect(exerciseViewLink).toBeVisible({ timeout: 5000 });
    const exerciseHref = await exerciseViewLink.getAttribute('href');
    expect(exerciseHref).toContain(`/msel/${mselId}/view`);

    // expect: Copy button for Exercise View URL is visible
    const copyExerciseButton = page.getByRole('button', { name: /Copy Exercise View URL/ });
    await expect(copyExerciseButton).toBeVisible({ timeout: 5000 });

    // 2. Verify MSEL Starter URL section
    const starterUrlSection = page.getByText('MSEL Starter URL');
    await expect(starterUrlSection).toBeVisible({ timeout: 5000 });

    // expect: Starter URL link is visible with correct format
    const starterLink = page.getByRole('link', { name: serviceUrlPattern(Services.Blueprint.UI) }).nth(1);
    await expect(starterLink).toBeVisible({ timeout: 5000 });
    const starterHref = await starterLink.getAttribute('href');
    expect(starterHref).toContain(`/starter/?msel=${mselId}`);

    // expect: Copy button for Starter URL is visible
    const copyStarterButton = page.getByRole('button', { name: /Copy MSEL Starter URL/ });
    await expect(copyStarterButton).toBeVisible({ timeout: 5000 });
  });
});
