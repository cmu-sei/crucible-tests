// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  deleteOrganization,
  listOrganizations,
  navigateToMselSection,
} from '../../test-helpers';

test.describe('Teams and Organizations Management', () => {
  let token: string;
  let mselId: string;
  let mselName: string;
  let createdOrgId: string | undefined;

  test.beforeEach(async () => {
    // Seed: create a MSEL
    token = await getBlueprintToken();
    const msel = await createMsel(token);
    mselId = msel.id;
    mselName = msel.name;
  });

  test.afterEach(async () => {
    // Cleanup: delete any created organization and the MSEL
    try {
      if (createdOrgId) await deleteOrganization(token, createdOrgId);
    } catch (err) {
      console.warn(`Cleanup failed for organization ${createdOrgId}: ${err}`);
    }
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Create Organization', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to the MSEL Organizations section
    await navigateToMselSection(page, mselId, 'Organizations');

    // expect: Organizations list table is visible
    const orgsList = page.locator('mat-table, [role="table"]').first();
    await expect(orgsList).toBeVisible({ timeout: 10000 });

    // Click 'Add organization' button to open the dropdown menu
    const addOrgButton = page.getByRole('button', { name: 'Add organization' });
    await expect(addOrgButton).toBeVisible({ timeout: 5000 });
    await addOrgButton.click();

    // expect: Dropdown menu with 'New Organization' option appears
    const newOrgMenuItem = page.getByRole('menuitem', { name: 'New Organization' });
    await expect(newOrgMenuItem).toBeVisible({ timeout: 5000 });
    await newOrgMenuItem.click();

    // expect: Organization creation dialog is displayed
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Enter organization details - Long Name (required)
    const longNameField = dialog.getByRole('textbox', { name: 'Long Name' });
    await expect(longNameField).toBeVisible({ timeout: 5000 });
    await longNameField.fill('Cyber Defense Organization');

    // expect: Long Name field accepts input
    await expect(longNameField).toHaveValue('Cyber Defense Organization');

    // Enter Short Name (required)
    const shortNameField = dialog.getByRole('textbox', { name: 'Short Name' });
    await expect(shortNameField).toBeVisible({ timeout: 5000 });
    await shortNameField.fill('CDO');

    // expect: Short Name field accepts input
    await expect(shortNameField).toHaveValue('CDO');

    // Enter Summary (required)
    const summaryField = dialog.getByRole('textbox', { name: 'Summary' });
    await expect(summaryField).toBeVisible({ timeout: 5000 });
    await summaryField.fill('Organization responsible for cybersecurity defense operations');

    // expect: Summary field accepts input
    await expect(summaryField).toHaveValue('Organization responsible for cybersecurity defense operations');

    // Enter Email (required)
    const emailField = dialog.getByRole('textbox', { name: 'Email' });
    await expect(emailField).toBeVisible({ timeout: 5000 });
    await emailField.fill('cdo@example.com');

    // expect: Email field accepts input
    await expect(emailField).toHaveValue('cdo@example.com');

    // Click 'Save' button
    const saveButton = dialog.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    // expect: Dialog closes
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // expect: Organization is created successfully and appears in the list
    const newOrgRow = page.getByRole('row').filter({ hasText: 'Cyber Defense Organization' });
    await expect(newOrgRow).toBeVisible({ timeout: 10000 });

    // Capture the organization ID for cleanup
    const orgs = await listOrganizations(token, mselId);
    const createdOrg = orgs.find((o: any) => o.name === 'Cyber Defense Organization');
    if (createdOrg) {
      createdOrgId = createdOrg.id;
    }
  });
});
