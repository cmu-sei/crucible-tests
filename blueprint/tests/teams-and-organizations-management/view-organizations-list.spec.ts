// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createOrganization,
  deleteOrganization,
  navigateToMselSection,
} from '../../test-helpers';

test.describe('Teams and Organizations Management', () => {
  let token: string;
  let mselId: string;
  let mselName: string;
  let orgId: string;

  test.beforeEach(async () => {
    // Seed: create a MSEL with an organization
    token = await getBlueprintToken();
    const msel = await createMsel(token);
    mselId = msel.id;
    mselName = msel.name;

    const org = await createOrganization(token, mselId, { name: 'Test Organization Omega' });
    orgId = org.id;
  });

  test.afterEach(async () => {
    // Cleanup: delete the organization and MSEL
    try {
      if (orgId) await deleteOrganization(token, orgId);
    } catch (err) {
      console.warn(`Cleanup failed for organization ${orgId}: ${err}`);
    }
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('View Organizations List', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to the MSEL Organizations section
    await navigateToMselSection(page, mselId, 'Organizations');

    // expect: Organizations list is displayed
    const orgsList = page.locator('mat-table, [role="table"]').first();
    await expect(orgsList).toBeVisible({ timeout: 10000 });

    // expect: The seeded organization is present
    const orgRow = page.getByRole('row').filter({ hasText: 'Test Organization Omega' });
    await expect(orgRow).toBeVisible({ timeout: 5000 });

    console.log(`Organizations list displayed with seeded organization: Test Organization Omega`);
  });
});
