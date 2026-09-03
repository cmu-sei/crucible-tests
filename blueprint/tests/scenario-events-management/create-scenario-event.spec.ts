// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  seedMselDataFields,
  navigateToMselSection,
} from '../../test-helpers';

test.describe('Scenario Events Management', () => {
  let token: string;
  let mselId: string;

  test.beforeEach(async () => {
    // Seed: create a MSEL with data fields for scenario event creation
    token = await getBlueprintToken();
    const msel = await createMsel(token);
    mselId = msel.id;
    await seedMselDataFields(token, mselId);
  });

  test.afterEach(async () => {
    // Cleanup: delete the MSEL (cascade deletes its scenario events)
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Create Scenario Event', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to the MSEL Scenario Events section
    await navigateToMselSection(page, mselId, 'Scenario Events');

    // 2. Click 'Add Event' or 'Create Scenario Event' button
    // First click the Action List button
    const actionListButton = page.getByRole('button', { name: /Action List/i }).first();
    await expect(actionListButton).toBeVisible({ timeout: 5000 });
    await actionListButton.click();

    // Then click Add New Event from the menu
    const addNewEventMenuItem = page.getByRole('menuitem', { name: 'Add New Event' });
    await expect(addNewEventMenuItem).toBeVisible({ timeout: 5000 });
    await addNewEventMenuItem.click();

    // expect: A scenario event creation form is displayed
    const dialog = page.locator('crucible-dialog').filter({ hasText: 'Create Event' });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 3. Fill in Description field (one of the standard data fields)
    const descriptionField = dialog.getByLabel('Description');
    await expect(descriptionField).toBeVisible({ timeout: 5000 });
    await descriptionField.fill('Initial phishing campaign');
    await expect(descriptionField).toHaveValue('Initial phishing campaign');

    // 11. Click 'Save' button and wait for the POST request
    const saveButton = dialog.getByRole('button', { name: /save|submit/i });
    await expect(saveButton).toBeVisible({ timeout: 5000 });

    const createPromise = page.waitForResponse(
      (res) => /\/api\/scenarioevents/i.test(res.url()) && res.request().method() === 'POST',
      { timeout: 10000 }
    );
    await saveButton.click();

    // expect: The scenario event is created successfully
    const createResponse = await createPromise;
    expect(createResponse.status()).toBe(200);

    // expect: Dialog closes after successful save
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // expect: The event appears in the list (row count increases)
    await expect(page.locator('table tbody tr').last()).toBeVisible({ timeout: 5000 });
  });
});
