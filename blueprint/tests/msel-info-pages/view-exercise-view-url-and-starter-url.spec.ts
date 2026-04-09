// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('MSEL Info Pages Management', () => {
  test('View Exercise View URL and Starter URL', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to a MSEL Config tab
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('networkidle');

    const mselLink = page.getByRole('link', { name: /Project Lagoon TTX/ }).first();
    await expect(mselLink).toBeVisible({ timeout: 10000 });
    await mselLink.click();
    await expect(page).toHaveURL(/.*\/build\?msel=.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // 1. Verify Exercise View URL section
    const exerciseViewSection = page.getByText('Exercise View URL');
    await expect(exerciseViewSection).toBeVisible({ timeout: 5000 });

    // expect: Exercise View URL link is visible with correct format
    const exerciseViewLink = page.getByRole('link', { name: /localhost:4725\/msel\/.*\/view/ });
    await expect(exerciseViewLink).toBeVisible({ timeout: 5000 });
    const exerciseHref = await exerciseViewLink.getAttribute('href');
    expect(exerciseHref).toContain('/msel/');
    expect(exerciseHref).toContain('/view');

    // expect: Copy button for Exercise View URL is visible
    const copyExerciseButton = page.getByRole('button', { name: /Copy Exercise View URL/ });
    await expect(copyExerciseButton).toBeVisible({ timeout: 5000 });

    // 2. Verify MSEL Starter URL section
    const starterUrlSection = page.getByText('MSEL Starter URL');
    await expect(starterUrlSection).toBeVisible({ timeout: 5000 });

    // expect: Starter URL link is visible with correct format
    const starterLink = page.getByRole('link', { name: /localhost:4725\/starter/ });
    await expect(starterLink).toBeVisible({ timeout: 5000 });
    const starterHref = await starterLink.getAttribute('href');
    expect(starterHref).toContain('/starter/');

    // expect: Copy button for Starter URL is visible
    const copyStarterButton = page.getByRole('button', { name: /Copy MSEL Starter URL/ });
    await expect(copyStarterButton).toBeVisible({ timeout: 5000 });
  });
});
