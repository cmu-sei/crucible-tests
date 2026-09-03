// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoGalleryAdmin, gotoAdminSection, Services } from '../../fixtures';
import { request as pwRequest, APIRequestContext } from '@playwright/test';
import { randomUUID } from 'crypto';

/**
 * Search and pagination are only meaningfully testable against a known number of
 * rows, so this spec seeds its own set of users rather than asserting against
 * whatever the database happens to contain. `POST /api/users` accepts an
 * arbitrary id/name pair (Gallery.Api/Services/UserService.CreateAsync), so no
 * Keycloak account or first-login is required for the row to appear in the list.
 */
const SEEDED_USER_COUNT = 6;
const PAGE_SIZE = 5;

async function galleryApi<T>(fn: (ctx: APIRequestContext, token: string) => Promise<T>): Promise<T> {
  const ctx = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const tokenRes = await ctx.post(`${Services.Keycloak}/realms/crucible/protocol/openid-connect/token`, {
      form: {
        grant_type: 'password',
        client_id: 'gallery.ui',
        username: 'admin',
        password: 'admin',
        scope: 'openid profile gallery',
      },
    });
    if (!tokenRes.ok()) {
      throw new Error(`Failed to get Gallery API token: ${tokenRes.status()} ${await tokenRes.text()}`);
    }
    return await fn(ctx, (await tokenRes.json()).access_token);
  } finally {
    await ctx.dispose();
  }
}

test.describe('User Management', () => {
  // Unique per test so a parallel worker's seeded users can never be caught by
  // this spec's search term or its cleanup.
  let namePrefix: string;
  let seededIds: string[];

  test.beforeEach(async () => {
    namePrefix = `SearchPageTest${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    seededIds = [];
    for (let i = 0; i < SEEDED_USER_COUNT; i++) {
      const id = randomUUID();
      await galleryApi(async (ctx, token) => {
        const res = await ctx.post(`${Services.Gallery.API}/api/users`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          data: { id, name: `${namePrefix} User ${i}` },
        });
        if (!res.ok()) {
          throw new Error(`Failed to seed Gallery user: ${res.status()} ${await res.text()}`);
        }
      });
      seededIds.push(id);
    }
  });

  // Runs even when the test body throws partway through.
  test.afterEach(async () => {
    await galleryApi(async (ctx, token) => {
      for (const id of seededIds) {
        const res = await ctx.delete(`${Services.Gallery.API}/api/users/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok() && res.status() !== 404) {
          console.warn(`Cleanup: failed to delete Gallery user ${id}: ${res.status()}`);
        }
      }
    });
  });

  test('User Search and Pagination', async ({ galleryAuthenticatedPage: page }) => {
    await gotoGalleryAdmin(page);

    // Navigate to Users section
    await gotoAdminSection(page, 'Users');
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();

    const searchField = page.getByRole('textbox', { name: 'Search' });
    const seededRows = page.getByRole('row').filter({ hasText: namePrefix });
    const rangeLabel = page.locator('.mat-mdc-paginator-range-label');

    // Baseline: read the unfiltered total off the paginator rather than counting
    // rendered rows, which the default page size caps at 20.
    await expect(rangeLabel).toContainText(/of \d+/);
    const unfilteredTotal = Number((await rangeLabel.textContent())!.match(/of (\d+)/)![1]);
    expect(unfilteredTotal).toBeGreaterThanOrEqual(SEEDED_USER_COUNT);

    // 1. Enter a search term in the Search field.
    //    The input filters on `keyup`, so fill() alone would not apply it.
    await searchField.fill(namePrefix);
    await searchField.press('End');

    // expect: User list filters to show only matching users
    await expect(seededRows).toHaveCount(SEEDED_USER_COUNT);
    await expect(rangeLabel).toContainText(`of ${SEEDED_USER_COUNT}`);

    // 3. Observe the 'Items per page' selector and page the filtered results
    const itemsPerPage = page.getByRole('combobox', { name: 'Items per page:' });
    await expect(itemsPerPage).toBeVisible();
    // The paginator renders a `.mat-mdc-paginator-touch-target` overlay on top of
    // the mat-select which swallows pointer events, so drive it from the keyboard.
    await itemsPerPage.press('Enter');
    const pageSizeListbox = page.getByRole('listbox');
    await expect(pageSizeListbox).toBeVisible();
    await pageSizeListbox.getByRole('option', { name: String(PAGE_SIZE), exact: true }).click();
    await expect(pageSizeListbox).toBeHidden();

    // expect: Only one page's worth of the matching users is rendered
    await expect(seededRows).toHaveCount(PAGE_SIZE);
    await expect(rangeLabel).toContainText(`1 – ${PAGE_SIZE} of ${SEEDED_USER_COUNT}`);

    // expect: The next page holds the remainder
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(seededRows).toHaveCount(SEEDED_USER_COUNT - PAGE_SIZE);
    await expect(rangeLabel).toContainText(
      `${PAGE_SIZE + 1} – ${SEEDED_USER_COUNT} of ${SEEDED_USER_COUNT}`
    );

    // 2. Clear the search field via the Clear Search affordance
    await page.getByRole('button', { name: 'Clear Search' }).click();

    // expect: All users are displayed again (the filter is lifted, so the total
    // returns to the pre-filter count)
    await expect(searchField).toHaveValue('');
    await expect(rangeLabel).toContainText(`of ${unfilteredTotal}`);
  });
});
