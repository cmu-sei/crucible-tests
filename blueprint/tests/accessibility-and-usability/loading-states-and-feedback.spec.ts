// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  tempBlueprintName,
} from '../../test-helpers';

/**
 * Loading feedback: while the MSEL list is fetching, a spinner stands in for the absent data
 * and the list's action buttons are disabled; once the data arrives the spinner is removed and
 * the rows render.
 *
 * Rewritten. The previous version was five "tests" in one, and none of them could fail:
 *
 *   - Every block was guarded by `if (await x.count() > 0)` or `if (actionButton)`, hunting
 *     speculative selectors (`button:has-text("Create")`, `"Add"`, `"Save"`, ...) against
 *     whatever the dashboard happened to render.
 *   - Test 1 collected loading indicators into `loadingFound` and never asserted on it,
 *     closing with the comment "If no loading indicator, that's okay".
 *   - Test 3 and Test 5 were gated on `main, [role="main"]`. Those elements do not exist
 *     anywhere in Blueprint, so both blocks were dead code.
 *   - Test 4's assertions were `expect(['pointer','default']).toContain(cursor)` and
 *     `expect(afterHover).toBeTruthy()` — the latter is an object literal, so unconditionally
 *     true.
 *   - Test 2's verdict, `expect(hasNotification || validationErrors > 0)`, only ran if a
 *     dialog was found, and passed either way.
 *   - Nine fixed sleeps stood in for waiting on anything real.
 *
 * The behaviour asserted here is traced to source: `msel-list.component.html:179-184` renders
 * a `mat-progress-spinner` under `@if (isLoading)`, and `msel-list.component.ts` initialises
 * `isLoading = true` (line 54), clearing it when the MSEL store emits (line 158). Line 138
 * drives `areButtonsDisabled` off the same store's loading signal.
 *
 * Rather than racing a fast load, the `/api/msels` response is held open with `page.route` and
 * released once the loading state has been observed. That is what removes the sleeps: every
 * step waits on a real state change.
 *
 * One measurement shaped the assertion: while loading, `mat-progress-spinner` has **count 1
 * but is not "visible" to Playwright** — it sits in a `mat-card` with no measured box at that
 * instant. So presence (`toHaveCount`) is the correct predicate here, not `toBeVisible`;
 * presence is exactly what `@if (isLoading)` controls.
 */
test.describe('Accessibility and Usability', () => {
  let token: string;
  let mselId: string;
  let mselName: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token, { name: tempBlueprintName('TestBP-Loading') });
    mselId = msel.id;
    mselName = msel.name;
  });

  test.afterEach(async () => {
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Loading States and Feedback', async ({ blueprintAuthenticatedPage: page }) => {
    // Hold the first MSEL-list response so the loading window is deterministic.
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    let heldOnce = false;
    await page.route(/\/api\/msels(\?|$)/i, async (route) => {
      if (heldOnce) {
        await route.continue();
        return;
      }
      heldOnce = true;
      await held;
      await route.continue();
    });

    // 1. Navigate to the MSEL list. The request is now parked mid-flight.
    await page.goto(`${Services.Blueprint.UI}/build`, { waitUntil: 'commit' });

    // expect: the list component is mounted, so what follows is about it and not an empty page.
    await expect(page.locator('app-msel-list')).toHaveCount(1, { timeout: 30000 });

    // expect: while the fetch is outstanding, the loading indicator is present.
    //
    // Located by `[role="progressbar"]`, not by the `mat-progress-spinner` tag. Measured over a
    // held request: `mat-progress-spinner` reports count 0 for the whole loading window while
    // `[role="progressbar"]` is a steady 1 -- Angular Material renders the spinner's host with
    // that ARIA role, and the custom element itself is not what the query matches here. Using
    // the role also asserts the part that matters for assistive technology.
    const spinner = page.locator('[role="progressbar"]');
    await expect(spinner).toHaveCount(1, { timeout: 30000 });

    // expect: and no rows are rendered yet — the spinner is standing in for absent data,
    // not decorating an already-populated list. The list is a `<mat-table>` of `<mat-row>`
    // elements (msel-list.component.html:62-167), not a native table, so `table tbody tr`
    // matches nothing here.
    await expect(page.locator('mat-row')).toHaveCount(0);

    // 2. Let the response through.
    release!();

    // expect: the spinner is removed once loading finishes — the state clears, not sticks.
    await expect(spinner).toHaveCount(0, { timeout: 30000 });

    // expect: the seeded MSEL renders. Filtered through the list's search box first, because
    // the list paginates and a fresh row may not land on page 1.
    //
    // Located by placeholder: the input carries `placeholder="Search"` and no label or
    // aria-label (msel-list.component.html:53), so `getByRole('textbox', { name: /search/i })`
    // does not match it -- a placeholder is not an accessible name here.
    const searchBox = page.getByPlaceholder('Search').first();
    await expect(searchBox).toBeVisible({ timeout: 15000 });
    await searchBox.fill(mselName);

    await expect(page.getByText(mselName).first()).toBeVisible({ timeout: 30000 });

    // expect: data replaced the spinner — a row is now rendered.
    await expect(page.locator('mat-row').first()).toBeVisible({ timeout: 15000 });
  });
});
