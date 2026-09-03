// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createRenderableScenarioEvent,
  createScenarioEvent,
  listScenarioEvents,
  seedMselDataFields,
  navigateToMselSection,
  tempBlueprintName,
} from '../../test-helpers';

/**
 * A MSEL with many scenario events: the grid renders all of them in reasonable time, and
 * filtering stays responsive.
 *
 * Rewritten. The previous version, like `large-export-performance`, treated missing data as a
 * pass: its `else` branch was `expect(hasMsel).toBe(false)` with the comment "Document that no
 * test data exists". It took that branch every run, because it navigated to `${UI}/msels`, which
 * is not a Blueprint route, so `a[href*="/msel/"]` matched nothing — the run log shows "No MSELs
 * found with timeline - test requires existing MSEL data". The only assertion that ever executed
 * was `expect(document.readyState === 'complete').toBe(true)`.
 *
 * Its scroll-performance measurement could not fail either. The `page.evaluate` block began:
 *
 *   const scrollContainer = document.querySelector('[class*="timeline"], ...') as HTMLElement;
 *   if (!scrollContainer) {
 *     return { fps: 60, dropped: 0, smooth: true };   // <-- hardcoded pass
 *   }
 *
 * so `expect(scrollMetrics.smooth).toBe(true)` was satisfied by a literal whenever the container
 * was absent. Its "FPS" was also computed from `setInterval(…, 50)` ticks, which measures the
 * timer, not frame production, and cannot detect jank.
 *
 * Frame-rate is not measurable honestly from Playwright without tracing, so this version drops
 * that claim rather than dressing up a fake number. It asserts what can be measured and matters:
 * all seeded events reach the DOM, the grid renders within a time budget, and filtering narrows
 * the grid — waiting on the filtered result instead of sleeping 500ms.
 */
test.describe('Performance and Optimization', () => {
  const EVENT_COUNT = 60;
  const UNIQUE_TITLE = 'ZZUniqueTimelineEvent';

  let token: string;
  let mselId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token, {
      name: tempBlueprintName('TestBP-TimelinePerf'),
      description: 'Seeded to measure timeline rendering.',
    });
    mselId = msel.id;

    await seedMselDataFields(token, mselId);
    for (let i = 0; i < EVENT_COUNT - 1; i++) {
      await createScenarioEvent(token, mselId, { deltaSeconds: (i + 1) * 60 });
    }
    // One event carrying searchable text, so the filter assertion has a known target.
    await createRenderableScenarioEvent(token, mselId, UNIQUE_TITLE, {
      deltaSeconds: EVENT_COUNT * 60,
    });
  });

  test.afterEach(async () => {
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Large Timeline Performance', async ({ blueprintAuthenticatedPage: page }) => {
    // expect: the fixture is the size this spec claims to measure.
    const seeded = await listScenarioEvents(token, mselId);
    expect(seeded.length, 'seeded scenario event count').toBe(EVENT_COUNT);

    // 1. Open the Scenario Events grid and time the render.
    const startedAt = Date.now();
    await navigateToMselSection(page, mselId, 'Scenario Events');

    // The Scenario Events grid is a native `<table>` (scenario-event-list.component.html:10),
    // unlike the MSEL list which is a `<mat-table>` of `<mat-row>`. The template also emits
    // `tr.move-start-row` separator rows, so those are excluded to count only event rows.
    const rows = page.locator('table tbody tr:not(.move-start-row)');
    await expect(rows).toHaveCount(EVENT_COUNT, { timeout: 60000 });
    const renderSeconds = (Date.now() - startedAt) / 1000;

    // expect: every seeded event is rendered — no silent truncation.
    // expect: and it happens within a budget. 30s is generous for 60 rows; it is here to catch a
    // regression into quadratic rendering, not to police small variance.
    expect(
      renderSeconds,
      `rendering ${EVENT_COUNT} scenario events took ${renderSeconds.toFixed(1)}s`
    ).toBeLessThan(30);

    // 2. Filter the grid. The wait is on the filtered result, not a fixed 500ms.
    //
    // The search input is not rendered until the "Search Events" toggle is pressed --
    // `@if (showSearch)` gates it (scenario-event-list.component.html:14-19) -- and it carries no
    // placeholder, so it cannot be reached with getByPlaceholder the way the MSEL list's can.
    await page.getByRole('button', { name: 'Search Events' }).click();
    const searchBox = page.locator('input[matInput]').first();
    await expect(searchBox).toBeVisible({ timeout: 15000 });

    // The grid filters on keyup (`(keyup)="keyUp.next($event)"`), so type rather than set the
    // value -- a bare fill() would not trigger it.
    await searchBox.click();
    await searchBox.pressSequentially(UNIQUE_TITLE);

    // expect: filtering narrows the grid to the matching event.
    await expect(rows).toHaveCount(1, { timeout: 30000 });
    await expect(page.getByText(UNIQUE_TITLE).first()).toBeVisible({ timeout: 15000 });

    // expect: clearing the filter restores every row, so the filter is not destructive.
    // Two controls carry title="Clear Search" -- the input's matSuffix and a header button --
    // so this is scoped rather than left to resolve ambiguously.
    await page.getByRole('button', { name: 'Clear Search' }).first().click();
    await expect(rows).toHaveCount(EVENT_COUNT, { timeout: 30000 });
  });
});
