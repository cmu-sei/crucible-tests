// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  updateMsel,
  seedMselDataFields,
  listMselDataFields,
  navigateToMselSection,
  tempBlueprintName,
} from '../../test-helpers';

/**
 * Selecting which Gallery content a MSEL's data maps to.
 *
 * Rewritten. The previous version asserted nothing that could fail. Its whole body was nested
 * `if (await x.isVisible().catch(() => false))` blocks hunting speculative controls — "Add Event"
 * / "Create Event" / "New Event", then "Select from Gallery" / "Browse Gallery" / "Gallery
 * Content" — none of which exist in Blueprint. On a miss it navigated to `${UI}/events/create`,
 * not a Blueprint route, waited for `networkidle`, and ended in a `console.log` with no
 * assertion. The run log shows both fallbacks firing verbatim: "Create event button not found -
 * attempting direct navigation" then "Gallery integration not yet available in Blueprint" — and
 * the spec still reported green.
 *
 * Blueprint does implement Gallery content selection, just not as an event-creation dialog. A
 * MSEL's DataFields each carry a `galleryArticleParameter`, chosen from a dropdown in the
 * **Integration** column of the Data Fields section (`data-field-list.component.html:257-272`).
 * That mapping is what tells Gallery which field supplies each article property, and it is what
 * `galleryToDo()` checks before a push is allowed. This spec drives that real surface.
 *
 * Note the dropdown lists only *unused* options — `getUnusedGalleryOptions(...)` — so once a
 * parameter is assigned to one field it disappears from the other fields' menus. That is the
 * behaviour asserted at the end, and it is why the spec re-reads the options rather than assuming
 * a fixed list.
 */
test.describe('Integration with Crucible Services', () => {
  let token: string;
  let mselId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token, { name: tempBlueprintName('TestBP-GalleryContent') });
    mselId = msel.id;

    // Gallery must be on for the Integration column to offer article parameters.
    await updateMsel(token, mselId, { useGallery: true });
    await seedMselDataFields(token, mselId);
  });

  test.afterEach(async () => {
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Gallery Integration - Content Selection', async ({ blueprintAuthenticatedPage: page }) => {
    // expect: the fixture has DataFields to map, so what follows is not vacuous.
    const fields = await listMselDataFields(token, mselId);
    expect(fields.length, 'seeded DataField count').toBeGreaterThan(0);

    await navigateToMselSection(page, mselId, 'Data Fields');

    // expect: the Integration column exists — this is the Gallery content-selection surface.
    await expect(page.getByText('Integration', { exact: true }).first()).toBeVisible({
      timeout: 30000,
    });

    const integrationSelects = page.locator('mat-select.integration');
    await expect(integrationSelects.first()).toBeVisible({ timeout: 30000 });

    // 1. Open the first field's Integration dropdown.
    await integrationSelects.first().click();

    const options = page.getByRole('option');
    await expect(options.first()).toBeVisible({ timeout: 15000 });

    // expect: Gallery article parameters are offered, labelled "Gallery <Parameter>"
    // (data-field-list.component.html:267).
    const galleryOptions = options.filter({ hasText: /^Gallery / });
    const galleryOptionCount = await galleryOptions.count();
    expect(
      galleryOptionCount,
      'the Integration dropdown should offer Gallery article parameters'
    ).toBeGreaterThan(0);

    // 2. Select one and confirm it sticks.
    const chosenLabel = (await galleryOptions.first().textContent())?.trim() ?? '';
    expect(chosenLabel).toMatch(/^Gallery /);
    const chosenParameter = chosenLabel.replace(/^Gallery\s+/, '');

    await galleryOptions.first().click();
    await expect(options.first()).toBeHidden({ timeout: 15000 });

    // expect: the selection is reflected in the field's control.
    await expect(integrationSelects.first()).toContainText(chosenParameter, { timeout: 15000 });

    // expect: it persisted server-side — `(selectionChange)="saveChange(element)"` saves
    // immediately, so this is asserted through the API rather than from the UI label alone.
    await expect
      .poll(
        async () => {
          const after = await listMselDataFields(token, mselId);
          return after.some((f: any) => f.galleryArticleParameter === chosenParameter);
        },
        {
          timeout: 30000,
          intervals: [250, 500, 1000],
          message: `a DataField should now carry galleryArticleParameter "${chosenParameter}"`,
        }
      )
      .toBe(true);

    // 3. expect: the parameter is no longer offered elsewhere — the dropdown lists only unused
    //    options, so a Gallery property cannot be double-assigned.
    await integrationSelects.nth(1).click();
    await expect(page.getByRole('option').first()).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole('option').filter({ hasText: new RegExp(`^Gallery ${chosenParameter}$`) })
    ).toHaveCount(0);
  });
});
