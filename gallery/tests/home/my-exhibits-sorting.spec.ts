// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { APIRequestContext, request as pwRequest } from '@playwright/test';
import { test, expect, Services } from '../../fixtures';
import { getUserToken } from '../../../keycloak-admin';

/**
 * My Exhibits Landing Page §2.2 — My Exhibits Table Sorting.
 *
 * Sorting can only be proved with several rows whose ordering differs per column, and
 * the worker-scoped `seededExhibit` is a single exhibit — so this spec seeds three of
 * its own exhibits, in three collections, with descriptions and creation order all
 * chosen so that every column produces a *different* order. `afterEach` deletes exactly
 * the ids it created (no prefix purge — sibling specs are seeding concurrently).
 *
 * `ExhibitService.GetUserExhibitsAsync` returns only exhibits where the caller is a
 * TeamUser, so each seeded exhibit also needs a team with the admin user on it or it
 * never appears in My Exhibits.
 *
 * The plan's step 4 says 'Created By'; that column does not exist in
 * `home-app.component.html` (columns are name/description/collection/dateCreated), so
 * the Description header is exercised in its place.
 */

interface SortFixture {
  collectionIds: string[];
  exhibitIds: string[];
  teamIds: string[];
  namePrefix: string;
  names: { a: string; b: string; c: string };
}

async function apiContext(): Promise<APIRequestContext> {
  const token = await getUserToken('admin', 'admin', 'gallery.ui', 'openid profile gallery');
  return pwRequest.newContext({
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
}

async function post<T>(api: APIRequestContext, path: string, data: unknown): Promise<T> {
  const response = await api.post(`${Services.Gallery.API}${path}`, { data });
  if (!response.ok()) {
    throw new Error(`POST ${path} failed: ${response.status()} ${await response.text()}`);
  }
  return (await response.json()) as T;
}

/**
 * Seed three exhibits whose name / collection / description / creation orders all differ.
 *
 * | suffix | collection      | description | created |
 * |--------|-----------------|-------------|---------|
 * | A      | ...Coll2        | zeta        | 3rd     |
 * | B      | ...Coll3        | mu          | 1st     |
 * | C      | ...Coll1        | alpha       | 2nd     |
 */
async function seedSortableExhibits(api: APIRequestContext): Promise<SortFixture> {
  const users: Array<{ id: string; name: string }> = await (
    await api.get(`${Services.Gallery.API}/api/users`)
  ).json();
  const admin = users.find((u) => u.name?.toLowerCase().includes('admin'));
  if (!admin) {
    throw new Error('Admin user not found in the Gallery database');
  }

  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const namePrefix = `ZZSortEx ${stamp}`;
  const names = { a: `${namePrefix} A`, b: `${namePrefix} B`, c: `${namePrefix} C` };

  const collectionIds: string[] = [];
  for (const suffix of ['1', '2', '3']) {
    const collection = await post<{ id: string }>(api, '/api/collections', {
      name: `ZZSortColl${suffix} ${stamp}`,
      description: 'Auto-seeded collection for Playwright tests',
    });
    collectionIds.push(collection.id);
  }
  const [coll1, coll2, coll3] = collectionIds;

  // Creation order B, C, A so that the Created column sorts differently from every
  // other column. Each POST is awaited separately, so dateCreated is strictly ordered.
  const creationOrder = [
    { name: names.b, collectionId: coll3, description: 'mu' },
    { name: names.c, collectionId: coll1, description: 'alpha' },
    { name: names.a, collectionId: coll2, description: 'zeta' },
  ];

  const exhibitIds: string[] = [];
  const teamIds: string[] = [];
  for (const spec of creationOrder) {
    const exhibit = await post<{ id: string }>(api, '/api/exhibits', {
      name: spec.name,
      description: spec.description,
      collectionId: spec.collectionId,
      showAdvanceButton: false,
    });
    exhibitIds.push(exhibit.id);
    const team = await post<{ id: string }>(api, '/api/teams', {
      name: `${spec.name} Team`,
      shortName: 'ZZSRT',
      exhibitId: exhibit.id,
    });
    teamIds.push(team.id);
    await post(api, '/api/teamusers', { teamId: team.id, userId: admin.id, isObserver: false });
  }

  return { collectionIds, exhibitIds, teamIds, namePrefix, names };
}

async function cleanupSortableExhibits(api: APIRequestContext, fixture: SortFixture): Promise<void> {
  for (const id of fixture.teamIds) {
    await api.delete(`${Services.Gallery.API}/api/teams/${id}`);
  }
  for (const id of fixture.exhibitIds) {
    await api.delete(`${Services.Gallery.API}/api/exhibits/${id}`);
  }
  for (const id of fixture.collectionIds) {
    await api.delete(`${Services.Gallery.API}/api/collections/${id}`);
  }
}

test.describe('My Exhibits Landing Page', () => {
  let api: APIRequestContext;
  let fixture: SortFixture;

  test.beforeEach(async () => {
    api = await apiContext();
    fixture = await seedSortableExhibits(api);
  });

  test.afterEach(async () => {
    try {
      await cleanupSortableExhibits(api, fixture);
    } finally {
      await api.dispose();
    }
  });

  test('My Exhibits Table Sorting', async ({ galleryAuthenticatedPage: page }) => {
    const { names, namePrefix } = fixture;

    await page.goto(Services.Gallery.UI, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('table')).toBeVisible();

    // Collapse the paginated list onto this spec's three rows. The Search input filters
    // on `(keyup)`, so `fill()` alone would not trigger `applyFilter`.
    const search = page.getByRole('textbox', { name: 'Search' });
    await search.fill(namePrefix);
    await search.press('End');

    const nameCells = page.locator('mat-row .mat-column-name');
    await expect(nameCells).toHaveCount(3);

    const header = (label: string) =>
      page.locator('mat-header-cell').filter({ hasText: new RegExp(`^${label}$`) });

    // No column is sorted yet.
    await expect(header('Name')).toHaveAttribute('aria-sort', 'none');

    // 1. Click the 'Name' column header.
    await header('Name').click();

    // expect: Exhibits are sorted by name.
    await expect(nameCells).toHaveText([names.a, names.b, names.c]);
    // expect: A sort indicator arrow is visible.
    await expect(header('Name')).toHaveAttribute('aria-sort', 'ascending');
    await expect(header('Name').locator('.mat-sort-header-arrow')).toBeVisible();

    // 2. Click the 'Name' column header again.
    await header('Name').click();

    // expect: Sort order reverses.
    await expect(nameCells).toHaveText([names.c, names.b, names.a]);
    await expect(header('Name')).toHaveAttribute('aria-sort', 'descending');

    // 3. Click the 'Collection' column header.
    // Collections are named ...Coll1/2/3 and hold C/A/B respectively, so sorting by
    // collection produces an order that matches no other column.
    await header('Collection').click();

    // expect: Exhibits are sorted by collection name.
    await expect(nameCells).toHaveText([names.c, names.a, names.b]);
    await expect(header('Collection')).toHaveAttribute('aria-sort', 'ascending');
    await expect(header('Name')).toHaveAttribute('aria-sort', 'none');
    await expect(page.locator('mat-row .mat-column-collection')).toHaveText([
      new RegExp(`^ZZSortColl1 `),
      new RegExp(`^ZZSortColl2 `),
      new RegExp(`^ZZSortColl3 `),
    ]);

    // 4. Click the 'Description' column header (the plan's 'Created By' column does not
    // exist in this table — see the doc comment).
    // Descriptions are alpha/mu/zeta on C/B/A.
    await header('Description').click();

    // expect: Exhibits are sorted by description.
    await expect(page.locator('mat-row .mat-column-description')).toHaveText([
      'alpha',
      'mu',
      'zeta',
    ]);
    await expect(nameCells).toHaveText([names.c, names.b, names.a]);
    await expect(header('Description')).toHaveAttribute('aria-sort', 'ascending');

    // 5. Click the 'Created' column header.
    // Creation order was B, C, A.
    await header('Created').click();

    // expect: Exhibits are sorted by creation date.
    await expect(nameCells).toHaveText([names.b, names.c, names.a]);
    await expect(header('Created')).toHaveAttribute('aria-sort', 'ascending');
    // And the rendered timestamps are non-decreasing.
    const created = await page.locator('mat-row .mat-column-dateCreated').allInnerTexts();
    expect(created.map((c) => c.trim())).toEqual([...created.map((c) => c.trim())].sort());

    // Descending reverses it, proving the Created header toggles like the others.
    await header('Created').click();
    await expect(nameCells).toHaveText([names.a, names.c, names.b]);
    await expect(header('Created')).toHaveAttribute('aria-sort', 'descending');
  });
});
