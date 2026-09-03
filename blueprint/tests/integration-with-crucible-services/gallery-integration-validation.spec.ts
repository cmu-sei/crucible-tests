// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  updateMsel,
  getMsel,
  navigateToMsel,
  tempBlueprintName,
} from '../../test-helpers';

/**
 * Gallery integration: the Config tab's unassigned-article-parameter validation.
 *
 * Rewritten. The previous version opened `/build`, took the globally first MSEL link, and
 * ran a bare `test.skip()` when there was none — reporting green without asserting anything
 * on a stack with no pre-existing MSELs, and touching a MSEL it did not own on any other.
 * Its Gallery locators were comma-joined `text=` selectors
 * (`'text=/WARNING.*Gallery.*missing required fields/i, text=/missing required fields/i'`),
 * which Playwright's `text=` engine cannot combine, so they matched **zero** elements; the
 * result was then only stored in an unused `warningVisible` variable and never asserted.
 * The whole push section was additionally wrapped in `if (pushVisible)`.
 *
 * This version seeds its own MSEL, so it is independent of database shape.
 *
 * The behaviour under test is `galleryWarningMessage()` (`msel-info.component.ts:516`),
 * which delegates to `galleryToDo()` (line 791). With Gallery enabled and no exhibit pushed,
 * the API populates `galleryArticleParameters` with all 12 enum names, and `galleryToDo()`
 * is true for as long as any of them is not claimed by a DataField's
 * `galleryArticleParameter`. Verified against the live API: a MSEL created through
 * `POST /api/msels` then switched to `useGallery: true` reports
 * `galleryArticleParameters` = ["Name","Description","Status","SourceType","SourceName",
 * "Url","DatePosted","OpenInNewTab","CardId","ToOrg","FromOrg","Summary"] and **zero**
 * DataFields, so every parameter is unassigned and the warning must render.
 *
 * The user-visible consequence is asserted as well: Push Integrations is bound to
 * `[disabled]="... || (msel.useGallery && galleryToDo()) || ..."`
 * (`msel-info.component.html:129`), so it must be disabled in this state.
 */
test.describe('Integration with Crucible Services', () => {
  let token: string;
  let mselId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token, { name: tempBlueprintName('TestBP-GalleryValid') });
    mselId = msel.id;

    // Enable Gallery. The Config tab saves explicitly, so seeding the flag via the API keeps
    // this spec about the validation rather than about the save mechanism.
    await updateMsel(token, mselId, { useGallery: true });
  });

  test.afterEach(async () => {
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Gallery Integration Validation', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Confirm the precondition the warning depends on, so a future API change that stops
    //    populating these parameters fails here instead of silently voiding the assertion.
    const seeded = await getMsel(token, mselId);
    expect(seeded.useGallery).toBe(true);
    expect(seeded.galleryExhibitId ?? null).toBeNull();
    expect(Array.isArray(seeded.galleryArticleParameters)).toBe(true);
    expect(seeded.galleryArticleParameters.length).toBeGreaterThan(0);

    // 2. Open the seeded MSEL's Config tab.
    await navigateToMsel(page, mselId);

    const configTab = page.getByRole('tab', { name: 'Config' });
    await expect(configTab).toBeVisible({ timeout: 10000 });
    await expect(configTab).toHaveAttribute('aria-selected', 'true');

    // expect: Gallery shows as enabled, since that is what was seeded.
    const galleryCheckbox = page.locator('mat-checkbox').filter({ hasText: 'Gallery' }).first();
    await expect(galleryCheckbox).toBeVisible({ timeout: 10000 });
    await expect(galleryCheckbox.locator('input[type="checkbox"]')).toBeChecked();

    // 3. expect: the unassigned-parameter warning is rendered. This MSEL has no DataFields,
    //    so all 12 Gallery article parameters are unassigned.
    await expect(
      page.getByText(/There are unassigned Gallery Article Parameters in Data Fields/i)
    ).toBeVisible({ timeout: 10000 });

    // 4. expect: Push Integrations is blocked while parameters remain unassigned.
    const pushButton = page.getByRole('button', { name: 'Push Integrations' });
    await expect(pushButton).toBeVisible({ timeout: 10000 });
    await expect(pushButton).toBeDisabled();
  });
});
