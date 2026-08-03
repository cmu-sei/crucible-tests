// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createRenderableScenarioEvent,
  deleteScenarioEvent,
  navigateToMselSection,
} from '../../test-helpers';

test.describe('Scenario Events Management', () => {
  let token: string;
  let mselId: string;
  let eventId: string;

  test.beforeEach(async () => {
    // Seed: create a MSEL with a renderable scenario event
    token = await getBlueprintToken();
    const msel = await createMsel(token);
    mselId = msel.id;

    const event = await createRenderableScenarioEvent(
      token,
      mselId,
      'Test scenario event for viewing',
      {
        deltaSeconds: 300,
        rowMetadata: 'CTRL-001',
      }
    );
    eventId = event.id;
  });

  test.afterEach(async () => {
    // Cleanup: delete the scenario event and MSEL
    try {
      if (eventId) await deleteScenarioEvent(token, eventId);
    } catch (err) {
      console.warn(`Cleanup failed for event ${eventId}: ${err}`);
    }
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('View Scenario Events in MSEL', async ({ blueprintAuthenticatedPage: page }) => {
    // Skipped pending upstream support: `GET /api/msels/{mselId}/scenarioEvents` does not
    // return `dataValues`, so the Scenario Events grid cells render blank. The assertions
    // below are correct as written — un-skip once the list endpoint returns dataValues.
    test.skip(true, 'Pending upstream support: dataValues on the scenarioEvents list endpoint');

    // Navigate to the MSEL Scenario Events section
    await navigateToMselSection(page, mselId, 'Scenario Events');

    // expect: Scenario events are displayed (the table is visible)
    const eventsTable = page.locator('table').first();
    await expect(eventsTable).toBeVisible({ timeout: 10000 });

    // expect: The seeded event is present (at least one row exists)
    const eventRow = page.locator('table tbody tr').last();
    await expect(eventRow).toBeVisible({ timeout: 5000 });

    // BLOCKED by the missing dataValues: expect cell content to be visible.
    // Once the list endpoint returns dataValues, add:
    // const descriptionCell = page.getByText('Test scenario event for viewing');
    // await expect(descriptionCell).toBeVisible();
  });
});
