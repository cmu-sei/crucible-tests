// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect } from '@playwright/test';
import { Services, authenticateBlueprintWithKeycloak } from '../../fixtures';

test.describe('Organizations Management (Admin)', () => {
  test('Create New Organization', async ({ page }) => {
    await authenticateBlueprintWithKeycloak(page);

    await page.goto(`${Services.Blueprint.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const organizationsLink = page.locator('a:has-text("Organizations"), button:has-text("Organizations")').first();
    await organizationsLink.click();
    await page.waitForLoadState('domcontentloaded');

    // 1. Click 'Add Organization' button
    const addButton = page.locator('button:has-text("Add Organization"), button:has-text("Add")').first();
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();

    // expect: Organization creation form appears
    const orgForm = page.locator('form, mat-dialog-container, [role="dialog"]');
    await expect(orgForm).toBeVisible({ timeout: 5000 });

    // expect: Form includes: Name, Short Name, Description fields
    const nameField = page.locator('input[formcontrolname*="name"], input[placeholder*="Name"]').first();
    const shortNameField = page.locator('input[formcontrolname*="shortName"], input[placeholder*="Short"]').first();
    const descriptionField = page.locator('textarea[formcontrolname*="description"], textarea').first();

    // 2. Enter organization details
    await nameField.fill('Acme Corporation');
    await shortNameField.fill('ACME');
    await descriptionField.fill('External organization partner');

    // expect: Fields accept input
    await expect(nameField).toHaveValue('Acme Corporation');
    await expect(shortNameField).toHaveValue('ACME');
    await expect(descriptionField).toHaveValue('External organization partner');

    // 3. Click 'Save'
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Submit")').first();
    await saveButton.click();
    await page.waitForTimeout(2000);

    // expect: Organization is created successfully
    // expect: New organization appears in the table
    const newOrg = page.locator('text=Acme Corporation');
    await expect(newOrg).toBeVisible({ timeout: 5000 });
  });
});
