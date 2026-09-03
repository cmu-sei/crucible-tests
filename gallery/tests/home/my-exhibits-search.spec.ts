// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { APIRequestContext, request as pwRequest } from '@playwright/test';
import { test, expect, Services } from '../../fixtures';
import { getUserToken } from '../../../keycloak-admin';

/**
 * My Exhibits Landing Page §2.3 — My Exhibits Search.
 *
 * The search input is bound with `(keyup)="applyFilter($event.target.value)"`, so a
 * `fill()` alone does **not** filter — every fill is followed by a key press.
 * `applyFilter` matches exhibit name, collection name and creator name, so this spec
 * exercises both the name path and the collection path (the collection name is a string
 * the exhibit's own name does not contain).
 *
 * The spec seeds two exhibits of its own sharing a unique prefix, in two differently
 * named collections. That makes every assertion independent of the rest of the list:
 * filtering on the shared prefix must yield exactly those two rows, filtering on one
 * name must drop the other, and the paginator's total tells us whether clearing restored
 * the full data set. Row *counts* of the unfiltered list are deliberately not asserted —
 * sibling specs create and delete exhibits concurrently.
 *
 * `ExhibitService.GetUserExhibitsAsync` only returns exhibits the caller is a TeamUser
 * on, so each seeded exhibit needs a team with the admin user on it to appear at all.
 * `afterEach` deletes exactly the ids created (never a name-prefix purge).
 */

interface SearchFixture {
  prefix: string;
  alphaName: string;
  betaName: string;
  alphaCollectionName: string;
  collectionIds: string[];
  exhibitIds: string[];
  teamIds: string[];
}

async function post<T>(api: APIRequestContext, path: string, data: unknown): Promise<T> {
  const response = await api.post(`${Services.Gallery.API}${path}`, { data });
  if (!response.ok()) {
    throw new Error(`POST ${path} failed: ${response.status()} ${await response.text()}`);
  }
  return (await response.json()) as T;
}

/** Total row count from the paginator range label, e.g. '1 – 2 of 7' -> 7. */
async function paginatorTotal(text: string): Promise<number> {
  const match = /of (\d+)/.exec(text);
  if (!match) {
    throw new Error(`Unexpected paginator label: ${JSON.stringify(text)}`);
  }
  return Number(match[1]);
}

test.describe('My Exhibits Landing Page', () => {
  let api: APIRequestContext;
  let fixture: SearchFixture;

  test.beforeEach(async () => {
    const token = await getUserToken('admin', 'admin', 'gallery.ui', 'openid profile gallery');
    api = await pwRequest.newContext({
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const users: Array<{ id: string; name: string }> = await (
      await api.get(`${Services.Gallery.API}/api/users`)
    ).json();
    const admin = users.find((u) => u.name?.toLowerCase().includes('admin'));
    if (!admin) {
      throw new Error('Admin user not found in the Gallery database');
    }

    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const prefix = `ZZSearchEx ${stamp}`;
    fixture = {
      prefix,
      alphaName: `${prefix} Alpha`,
      betaName: `${prefix} Beta`,
      alphaCollectionName: `ZZSearchCollAlpha ${stamp}`,
      collectionIds: [],
      exhibitIds: [],
      teamIds: [],
    };

    const specs = [
      { name: fixture.alphaName, collectionName: fixture.alphaCollectionName },
      { name: fixture.betaName, collectionName: `ZZSearchCollBeta ${stamp}` },
    ];
    for (const spec of specs) {
      const collection = await post<{ id: string }>(api, '/api/collections', {
        name: spec.collectionName,
        description: 'Auto-seeded collection for Playwright tests',
      });
      fixture.collectionIds.push(collection.id);
      const exhibit = await post<{ id: string }>(api, '/api/exhibits', {
        name: spec.name,
        description: 'Auto-seeded exhibit for Playwright tests',
        collectionId: collection.id,
        showAdvanceButton: false,
      });
      fixture.exhibitIds.push(exhibit.id);
      const team = await post<{ id: string }>(api, '/api/teams', {
        name: `${spec.name} Team`,
        shortName: 'ZZSCH',
        exhibitId: exhibit.id,
      });
      fixture.teamIds.push(team.id);
      await post(api, '/api/teamusers', { teamId: team.id, userId: admin.id, isObserver: false });
    }
  });

  test.afterEach(async () => {
    try {
      for (const id of fixture.teamIds) {
        await api.delete(`${Services.Gallery.API}/api/teams/${id}`);
      }
      for (const id of fixture.exhibitIds) {
        await api.delete(`${Services.Gallery.API}/api/exhibits/${id}`);
      }
      for (const id of fixture.collectionIds) {
        await api.delete(`${Services.Gallery.API}/api/collections/${id}`);
      }
    } finally {
      await api.dispose();
    }
  });

  test('My Exhibits Search', async ({ galleryAuthenticatedPage: page }) => {
    const { prefix, alphaName, betaName, alphaCollectionName } = fixture;

    await page.goto(Services.Gallery.UI, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('table')).toBeVisible();

    // 1. Locate the Search text field above the table.
    // expect: A search input field is visible.
    const search = page.getByRole('textbox', { name: 'Search' });
    await expect(search).toBeVisible();
    await expect(search).toHaveValue('');

    const rows = page.locator('mat-row');
    const nameCells = page.locator('mat-row .mat-column-name');
    const paginator = page.locator('mat-paginator');

    // Baseline: the unfiltered list holds at least this spec's two exhibits plus the
    // worker's `seededExhibit`.
    //
    // Polled rather than read once. MatPaginator's getRangeLabel renders '0 of 0' while
    // `length` is still 0, i.e. before GET /api/me/exhibits resolves — which satisfies
    // /of \d+/, so waiting for the label to exist does not mean the data arrived. Reading
    // the total at that instant yields 0 and fails this assertion; Firefox lost that race.
    // The same poll was already used for the post-clear check in step 3.
    await expect(paginator).toContainText(/of \d+/);
    await expect
      .poll(async () => paginatorTotal(await paginator.innerText()))
      .toBeGreaterThanOrEqual(3);

    // 2. Enter a search term that matches an exhibit name.
    await search.fill(prefix);
    await search.press('End');

    // expect: The table filters to show only matching exhibits.
    await expect(paginator).toContainText('1 – 2 of 2');
    await expect(nameCells).toHaveText([alphaName, betaName]);

    // Narrowing to one of the two names drops the other — filtering is really applied,
    // not merely re-rendered.
    await search.fill(alphaName);
    await search.press('End');
    await expect(nameCells).toHaveText([alphaName]);
    await expect(rows.filter({ hasText: betaName })).toHaveCount(0);

    // `applyFilter` also matches on collection name, so searching by collection finds
    // the exhibit through a string its own name does not contain.
    await search.fill(alphaCollectionName);
    await search.press('End');
    await expect(nameCells).toHaveText([alphaName]);
    await expect(rows.filter({ hasText: betaName })).toHaveCount(0);

    // 3. Clear the search field, using the app's own 'Clear Search' suffix button
    // (only rendered while the filter is non-empty).
    const clearButton = page.getByRole('button', { name: 'Clear Search' });
    await expect(clearButton).toBeVisible();
    await clearButton.click();

    // expect: All exhibits are displayed again — the paginator total goes back above the
    // filtered 1, and re-applying the shared prefix finds both rows again, so the data
    // set really was restored rather than left filtered.
    await expect(search).toHaveValue('');
    await expect(clearButton).toHaveCount(0);
    await expect
      .poll(async () => paginatorTotal(await paginator.innerText()))
      .toBeGreaterThanOrEqual(3);

    await search.fill(prefix);
    await search.press('End');
    await expect(nameCells).toHaveText([alphaName, betaName]);
    await search.fill('');
    await search.press('End');

    // 4. Enter a search term that matches no exhibits.
    await search.fill('ZZZZNONEXISTENT');
    await search.press('End');

    // expect: The table shows a 'No results found' message.
    await expect(rows).toHaveCount(0);
    await expect(page.getByText('No results found')).toBeVisible();
    // The header row survives; only data rows are filtered out.
    await expect(page.locator('mat-header-cell')).toHaveCount(4);
  });
});
