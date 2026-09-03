// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoGalleryAdmin } from '../../fixtures';

test.describe('Admin Navigation and UI', () => {
  test('Version Display', async ({ galleryAuthenticatedPage: page }) => {
    // 1. Navigate to the admin section
    await gotoGalleryAdmin(page);

    // expect: Version information is displayed at the bottom of the sidebar.
    //
    // Match on the version *shape*, not just "something is there".
    // `AdminContainerComponent.apiVersion` initialises to the literal 'ERROR!' and stays
    // that way if the /api/version call fails, so a loose `API .+` matcher passes on a
    // broken health check. Both halves must look like real versions:
    // uiVersion comes from environment.VERSION, apiVersion is the pre-'+' half of the
    // informational version (e.g. "0.0.0").
    const versions = page.getByText(/Versions: UI \S+, API \S+/);
    await expect(versions).toBeVisible();
    await expect(versions).toHaveText(/Versions: UI \d+\.\d+\.\d+\S*, API \d+\.\d+\.\d+\S*/);
    await expect(versions).not.toHaveText(/ERROR!/);
  });
});
