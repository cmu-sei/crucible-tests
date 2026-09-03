// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createRenderableScenarioEvent,
  navigateToMselSection,
} from '../../test-helpers';

test.describe('Scenario Events Management', () => {
  let token: string;
  let mselId: string;
  let eventId: string;

  test.beforeEach(async () => {
    // Seed: create a MSEL with a scenario event that has rich text content
    token = await getBlueprintToken();
    const msel = await createMsel(token);
    mselId = msel.id;

    const event = await createRenderableScenarioEvent(token, mselId, 'Test event with rich content for detail page', { deltaSeconds: 300 });
    eventId = event.id;
  });

  test.afterEach(async () => {
    // Cleanup: delete the MSEL (cascade deletes its events)
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Open Event in Detail Page', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to the MSEL Scenario Events section
    await navigateToMselSection(page, mselId, 'Scenario Events');

    // Verify scenario events are loaded
    const eventRow = page.locator('table tbody tr').last();
    await expect(eventRow).toBeVisible({ timeout: 5000 });

    // 1. Look for the View button (open in new tab) in the action menu
    const actionListButton = eventRow.getByRole('button', { name: /Action List/i });
    await expect(actionListButton).toBeVisible({ timeout: 5000 });
    await actionListButton.click();

    // Click the View option which opens in a new tab
    const viewMenuItem = page.getByRole('menuitem', { name: /view/i });
    await expect(viewMenuItem).toBeVisible({ timeout: 5000 });

    // expect: The Event Detail page opens in a new browser tab at /eventdetail
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page', { timeout: 10000 }),
      viewMenuItem.click(),
    ]);

    // Wait for the new page to load
    await newPage.waitForLoadState('domcontentloaded');

    // expect: URL includes msel, scenarioEvent, and dataValue query parameters
    await expect(newPage).toHaveURL(/.*\/eventdetail.*msel.*/, { timeout: 10000 });
    const detailUrl = newPage.url();
    expect(detailUrl).toContain('msel');
    expect(detailUrl).toContain(mselId);

    // expect: The data field content is displayed
    const topbar = newPage.locator('mat-toolbar').first();
    await expect(topbar).toBeVisible({ timeout: 5000 });

    await newPage.close();
  });
});
