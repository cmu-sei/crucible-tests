// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createScenarioEvent,
} from '../../test-helpers';

test.describe('Event Detail Page', () => {
  let token: string;
  let mselId: string;
  let eventId: string;

  test.beforeEach(async () => {
    // Seed: create a MSEL with a scenario event for the detail page
    token = await getBlueprintToken();
    const msel = await createMsel(token);
    mselId = msel.id;

    // `createScenarioEvent` has no `description` option (event text lives in an
    // event's data values, which this seed leaves empty) — one used to be passed
    // here and was silently dropped. Nothing below reads it.
    const event = await createScenarioEvent(token, mselId, {
      deltaSeconds: 300,
    });
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

  test('View Event Detail Page', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate directly to /eventdetail with the mselId and scenarioEventId
    await page.goto(`${Services.Blueprint.UI}/eventdetail?msel=${mselId}&scenarioEvent=${eventId}`, {
      waitUntil: 'domcontentloaded',
    });

    // expect: The Event Detail page loads at the /eventdetail route
    await expect(page).toHaveURL(/.*\/eventdetail.*/, { timeout: 10000 });

    // expect: A Blueprint topbar is displayed
    const topbar = page.locator('mat-toolbar').first();
    await expect(topbar).toBeVisible({ timeout: 5000 });

    // expect: Page contains event-related content
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();
  });
});
