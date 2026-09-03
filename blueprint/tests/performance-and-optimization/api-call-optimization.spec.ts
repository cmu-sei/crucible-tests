// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  navigateToMsel,
  tempBlueprintName,
} from '../../test-helpers';

/**
 * API-call hygiene across normal navigation: no runaway request counts, and no rapid-fire
 * duplicate requests to the same endpoint.
 *
 * Rewritten. The previous version measured **nothing at all**. It navigated to
 * `${Blueprint.UI}/msels` and `${Blueprint.UI}/teams` — neither route exists. Blueprint's
 * routes are `''`, `build`, `join`, `launch`, `manage`, `starter`, `assess`,
 * `msel/:mselid/view`, `mselpage/:id`, `admin`, `eventdetail` (app-routing.module.ts), so both
 * `goto`s landed on the router's fallback and issued no Blueprint API traffic. The run log
 * shows the consequence verbatim: "Total API calls: 0", "Cache ratio: 0.0%",
 * "Successful API calls: 0/0".
 *
 * With zero calls collected every assertion was vacuous:
 *   - `expect(apiCalls.length).toBeLessThan(100)` -> 0 < 100, always true.
 *   - `expect(rapidDuplicates.length).toBeLessThan(5)` -> 0 < 5, always true.
 *   - The per-endpoint cap ran inside `duplicateCalls.forEach(...)` over an empty array, so it
 *     executed zero assertions.
 *   - The success-rate check was wrapped in `if (successfulCalls.length > 0)`, so it was
 *     skipped entirely.
 * Three fixed sleeps and three `networkidle` waits padded it out.
 *
 * This version navigates real routes (`/build`, `/admin`, then a seeded MSEL), waits on
 * rendered state rather than sleeping, and asserts against traffic it has actually observed —
 * including a guard that traffic was seen at all, so the spec can no longer pass by measuring
 * nothing.
 */
test.describe('Performance and Optimization', () => {
  let token: string;
  let mselId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token, { name: tempBlueprintName('TestBP-ApiOpt') });
    mselId = msel.id;
  });

  test.afterEach(async () => {
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('API Call Optimization', async ({ blueprintAuthenticatedPage: page }) => {
    const apiCalls: Array<{ url: string; method: string; timestamp: number }> = [];

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes(Services.Blueprint.API) || url.includes(':4724')) {
        apiCalls.push({ url, method: request.method(), timestamp: Date.now() });
      }
    });

    // 1. /build — the MSEL list. Waits for a row, so the page is genuinely loaded.
    await page.goto(`${Services.Blueprint.UI}/build`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('mat-row').first()).toBeVisible({ timeout: 30000 });
    const afterBuild = apiCalls.length;

    // 2. /admin — a different surface with its own fetches.
    await page.goto(`${Services.Blueprint.UI}/admin`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({
      timeout: 30000,
    });

    // 3. The seeded MSEL, then back to /build.
    await navigateToMsel(page, mselId);
    await expect(page.getByRole('tab', { name: 'Config' })).toBeVisible({ timeout: 30000 });

    await page.goto(`${Services.Blueprint.UI}/build`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('mat-row').first()).toBeVisible({ timeout: 30000 });

    // expect: this navigation actually produced Blueprint API traffic. Without this guard the
    // assertions below are satisfied by an empty list — which is exactly how the previous
    // version passed while exercising nothing.
    expect(
      afterBuild,
      'loading /build should issue at least one Blueprint API request'
    ).toBeGreaterThan(0);
    expect(
      apiCalls.length,
      'the full navigation should issue more requests than /build alone'
    ).toBeGreaterThan(afterBuild);

    // expect: no runaway request count for four page loads.
    expect(apiCalls.length).toBeLessThan(100);

    // expect: no endpoint is hammered. Counted per path, ignoring the query string.
    const callsByPath = apiCalls.reduce<Record<string, number>>((acc, call) => {
      const path = call.url.split('?')[0];
      acc[path] = (acc[path] ?? 0) + 1;
      return acc;
    }, {});
    const worst = Object.entries(callsByPath).sort((a, b) => b[1] - a[1])[0];
    // Threshold is 12, not a rounder number, because of how permissions are currently loaded:
    // `PermissionDataService` is a root singleton that stores permissions in `_permissions` but
    // does not consult it before fetching, and 15 components call `load()` in ngOnInit. Measured:
    // `/api/me/systempermissions` is requested 11 times across these 4 page loads, against 4 for
    // the next-busiest endpoint. 12 sits just above that, so this fails if the duplication grows;
    // tighten it once the cache is reused. It is deliberately NOT set to 11 to avoid a spec that
    // encodes today's exact count as the expectation.
    expect(
      worst[1],
      `endpoint ${worst[0]} was requested ${worst[1]} times across 4 page loads`
    ).toBeLessThan(12);

    // expect: loading state suppresses rapid-fire duplicates — the same URL requested twice
    // inside 100ms. Compared against all earlier calls, not just the immediate next one: the
    // previous version only looked at `apiCalls[index + 1]`, so an interleaved third request
    // hid a duplicate pair.
    const rapidDuplicates = apiCalls.filter((call, i) =>
      apiCalls
        .slice(0, i)
        .some((earlier) => earlier.url === call.url && call.timestamp - earlier.timestamp < 100)
    );
    const dupsByPath = rapidDuplicates.reduce<Record<string, number>>((acc, call) => {
      const path = call.url.split('?')[0];
      acc[path] = (acc[path] ?? 0) + 1;
      return acc;
    }, {});

    // The permissions refetch accounts for most of these: 7 of the 11 observed rapid duplicates
    // are `/api/me/systempermissions`, fired near-simultaneously by components mounting together.
    // Excluding that known endpoint, everything else must stay minimal -- so a NEW source of
    // duplicate requests fails this, while the expected one does not mask it.
    const permissionsPath = `${Services.Blueprint.API}/me/systempermissions`;
    const otherDuplicates = Object.entries(dupsByPath).filter(
      ([path]) => !path.endsWith('/me/systempermissions')
    );
    const otherDuplicateCount = otherDuplicates.reduce((n, [, count]) => n + count, 0);
    expect(
      otherDuplicateCount,
      `unexpected rapid duplicate requests (excluding the known ${permissionsPath}): ` +
        JSON.stringify(otherDuplicates)
    ).toBeLessThan(5);

    // And the known duplication itself must not grow. Tighten/remove once the cache is reused.
    expect(
      dupsByPath[permissionsPath] ?? 0,
      'rapid duplicate /me/systempermissions requests'
    ).toBeLessThanOrEqual(8);
  });
});
