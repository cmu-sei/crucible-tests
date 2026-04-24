// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

test.describe('Administration - Scoring Models', () => {
  test('Scoring Models Section', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to Scoring Models admin section
    await navigateToAdminSection(page, 'Scoring Models');

    // expect: Scoring models section displays
    // expect: Sidebar shows Scoring Models section
    const scoringModelsLink = page.locator('mat-list-item').filter({ hasText: 'Scoring Models' });
    await expect(scoringModelsLink).toBeVisible({ timeout: 5000 });

    // expect: List of scoring models is shown
    const scoringModelsTable = page.locator('table');
    await expect(scoringModelsTable).toBeVisible({ timeout: 5000 });

    // expect: Search field is available
    const searchField = page.getByRole('textbox', { name: 'Search' });
    await expect(searchField).toBeVisible({ timeout: 5000 });

    // expect: Add Scoring Model button is available
    const addButton = page.getByRole('button', { name: 'Add Scoring Model' });
    await expect(addButton).toBeVisible({ timeout: 5000 });
  });
});
