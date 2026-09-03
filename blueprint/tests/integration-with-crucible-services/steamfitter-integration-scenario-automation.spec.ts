// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  updateMsel,
  tempBlueprintName,
} from '../../test-helpers';

/**
 * Verifies the "Applications to Integrate" section of the MSEL Info tab reflects the
 * MSEL's integration flags, and that the Scenario Events section (where Steamfitter
 * tasks are triggered from) is reachable.
 *
 * Rewritten. The previous version depended on a MSEL literally named "Project Lagoon
 * TTX" existing on the stack with Steamfitter pre-enabled. No such MSEL exists here —
 * `GET /api/msels` returns only `Standard MSEL` plus leaked `New MSEL` rows — so the
 * spec failed at its first locator on every run. It also used two `networkidle` waits,
 * which CLAUDE.md forbids.
 *
 * Now: seed a MSEL, enable all four integrations through the API, and assert the
 * checkboxes render that state. The MSEL is deleted in `afterEach` so it runs even
 * when the body throws.
 */
test.describe('Integration with Crucible Services', () => {
  let token: string;
  let mselId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token, {
      name: tempBlueprintName('TestBP-Steamfitter'),
      description: 'Seeded to verify integration checkboxes render MSEL flags.',
    });
    mselId = msel.id;

    // Enable every integration so each checkbox has a known, asserted state.
    await updateMsel(token, mselId, {
      useSteamfitter: true,
      usePlayer: true,
      useGallery: true,
      useCite: true,
    });
  });

  test.afterEach(async () => {
    if (mselId) {
      try {
        await deleteMsel(token, mselId);
      } catch (err) {
        console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
      }
    }
  });

  test('Steamfitter Integration - Scenario Automation', async ({
    blueprintAuthenticatedPage: page,
  }) => {
    await page.goto(`${Services.Blueprint.UI}/build?msel=${mselId}`, {
      waitUntil: 'domcontentloaded',
    });

    // The section list only renders once the MSEL has loaded, so it is the readiness signal.
    const infoSection = page.locator('mat-list-item').filter({ hasText: 'Info' }).first();
    await expect(infoSection).toBeVisible({ timeout: 30000 });

    // Every integration was enabled during seeding, so each box must be present AND checked.
    // Asserting the checked state (not just visibility) is what ties the UI to the MSEL's flags.
    for (const name of ['Steamfitter', 'Player', 'Gallery', 'CITE']) {
      const checkbox = page.getByRole('checkbox', { name });
      await expect(checkbox, `"${name}" integration checkbox should be visible`).toBeVisible({
        timeout: 15000,
      });
      await expect(
        checkbox,
        `"${name}" should be checked because the seeded MSEL enables it`
      ).toBeChecked();
    }

    // The Scenario Events section is where Steamfitter tasks get triggered from.
    const scenarioEvents = page
      .locator('mat-list-item')
      .filter({ hasText: 'Scenario Events' })
      .first();
    await expect(scenarioEvents).toBeVisible({ timeout: 15000 });
  });
});
