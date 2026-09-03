// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import { getBlueprintToken, createMsel, deleteMsel, tempBlueprintName } from '../../test-helpers';

/**
 * Sorting the /build MSEL list by Name, ascending then descending.
 *
 * Sorting can only be asserted against rows this test controls: the dev stack carries ~19
 * pre-existing MSELs and sibling specs seed more concurrently, so any assertion about the
 * whole table's order would be meaningless. The three seeded MSELs therefore share one
 * `groupToken`, which is typed into the Search box to collapse the table down to exactly
 * those rows before the order is checked.
 *
 * The previous version got this wrong: it built each name with a separate
 * `tempBlueprintName()` call (each embedding its own timestamp), then searched for
 * `mselA.name.substring(0, 15)`. That prefix matched only MSEL A, so B and C were filtered
 * out of the table and their row indices came back as -1.
 */
test.describe('MSEL Management', () => {
  let token: string;
  let ids: string[] = [];
  let groupToken: string;
  let names: { a: string; b: string; c: string };

  test.beforeEach(async () => {
    token = await getBlueprintToken();

    // One shared token across all three names so a single search returns exactly this set.
    groupToken = tempBlueprintName('TestBP-Sort');
    names = {
      a: `${groupToken}-AAA`,
      b: `${groupToken}-BBB`,
      c: `${groupToken}-CCC`,
    };

    // Create out of alphabetical order so a pass cannot be an artifact of insertion order.
    const created = [
      await createMsel(token, { name: names.b, description: 'Middle alphabetically' }),
      await createMsel(token, { name: names.c, description: 'Last alphabetically' }),
      await createMsel(token, { name: names.a, description: 'First alphabetically' }),
    ];
    ids = created.map((m) => m.id);
  });

  test.afterEach(async () => {
    for (const id of ids) {
      try {
        await deleteMsel(token, id);
      } catch (err) {
        console.warn(`Cleanup failed for MSEL ${id}: ${err}`);
      }
    }
    ids = [];
  });

  test('Sort MSELs', async ({ blueprintAuthenticatedPage: page }) => {
    await page.goto(`${Services.Blueprint.UI}/build`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 15000 });

    // Collapse the table to just this test's three rows.
    const searchBox = page.getByRole('textbox', { name: /search/i });
    await expect(searchBox).toBeVisible({ timeout: 10000 });
    await searchBox.fill(groupToken);

    const seededRows = page.getByRole('row').filter({ hasText: groupToken });
    await expect(seededRows).toHaveCount(3, { timeout: 15000 });

    /** Positions of the three seeded names within the currently-rendered rows. */
    const orderOfSeeded = async () => {
      const texts = await seededRows.allTextContents();
      return {
        a: texts.findIndex((t) => t.includes(names.a)),
        b: texts.findIndex((t) => t.includes(names.b)),
        c: texts.findIndex((t) => t.includes(names.c)),
      };
    };

    const nameColumnHeader = page.getByRole('columnheader', { name: /^Name/ });
    await expect(nameColumnHeader).toBeVisible({ timeout: 10000 });

    /**
     * Click the Name header until it reports the wanted direction, then assert the seeded
     * rows are in that order. `mat-sort-header` reflects state in `aria-sort`, so that
     * attribute flip is the deterministic re-sort signal — no sleep required.
     *
     * The list does not start unsorted: it loads already sorted by Name, so the first
     * click yields *descending*. Driving off the live `aria-sort` value rather than
     * assuming a starting state keeps this robust if that default ever changes.
     */
    const sortBy = async (direction: 'ascending' | 'descending') => {
      for (let attempt = 0; attempt < 3; attempt++) {
        if ((await nameColumnHeader.getAttribute('aria-sort')) === direction) return;
        await nameColumnHeader.click();
        await expect(nameColumnHeader).not.toHaveAttribute('aria-sort', 'none', {
          timeout: 10000,
        });
      }
      await expect(nameColumnHeader).toHaveAttribute('aria-sort', direction, { timeout: 10000 });
    };

    // --- Ascending: AAA before BBB before CCC ---
    await sortBy('ascending');
    await expect(nameColumnHeader).toHaveAttribute('aria-sort', 'ascending');

    let order = await orderOfSeeded();
    expect(order.a, 'AAA row not found after ascending sort').toBeGreaterThanOrEqual(0);
    expect(order.b, 'BBB row not found after ascending sort').toBeGreaterThanOrEqual(0);
    expect(order.c, 'CCC row not found after ascending sort').toBeGreaterThanOrEqual(0);
    expect(order.a).toBeLessThan(order.b);
    expect(order.b).toBeLessThan(order.c);

    // --- Descending: the order must actually reverse ---
    await sortBy('descending');
    await expect(nameColumnHeader).toHaveAttribute('aria-sort', 'descending');

    order = await orderOfSeeded();
    expect(order.c, 'CCC row not found after descending sort').toBeGreaterThanOrEqual(0);
    expect(order.b, 'BBB row not found after descending sort').toBeGreaterThanOrEqual(0);
    expect(order.a, 'AAA row not found after descending sort').toBeGreaterThanOrEqual(0);
    expect(order.c).toBeLessThan(order.b);
    expect(order.b).toBeLessThan(order.a);
  });
});
