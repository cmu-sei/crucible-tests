// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Scoring Models', () => {
  test('Create Scoring Model', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to admin scoring models section
    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const scoringModelsLink = page.locator('text=Scoring Models, a:has-text("Scoring Models"), mat-list-item:has-text("Scoring Models")').first();
    await expect(scoringModelsLink).toBeVisible({ timeout: 10000 });
    await scoringModelsLink.click();

    // expect: Create button is visible
    const createButton = page.locator('button:has(mat-icon:has-text("add")), button[aria-label*="create"], button[aria-label*="add"]').first();
    await expect(createButton).toBeVisible({ timeout: 10000 });

    // 2. Click 'Create' button
    await createButton.click();

    // expect: Create scoring model dialog opens
    const dialog = page.locator('mat-dialog-container, [role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 3. Enter scoring model name and description
    const nameField = page.locator('input[placeholder*="name"], input[placeholder*="description"], mat-form-field input').first();
    await nameField.fill('Test Scoring Model');

    // 5. Click 'Create' button
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').first();
    await saveButton.click();

    await page.waitForLoadState('domcontentloaded');
  });
});
