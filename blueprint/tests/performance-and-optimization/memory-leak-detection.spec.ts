// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  tempBlueprintName,
  navigateToMsel,
} from '../../test-helpers';

/**
 * Detects retained (leaked) DOM as the user switches between MSEL sections.
 *
 * ── How the measurement works, and why it is done this way ──
 *
 * Leak detection is easy to get wrong in a way that silently passes forever, so the
 * mechanics here are deliberate:
 *
 * 1. **Measure inside one document.** An SPA leak only accumulates while the document
 *    lives. Sampling across `page.goto` navigations resets the counters and makes any
 *    leak invisible by construction.
 *
 * 2. **Force a real GC via CDP `HeapProfiler.collectGarbage`.** `window.gc()` is
 *    `undefined` unless Chromium is launched with `--js-flags=--expose-gc`. What survives
 *    a forced collection is held by a live reference — a leak — not merely uncollected
 *    garbage.
 *
 * 3. **Count detached nodes from the heap snapshot's `detachedness` field**, not by
 *    subtracting `document.querySelectorAll('*')` from the `Performance.getMetrics`
 *    `Nodes` counter. That subtraction is not a valid measure of retention: `Nodes`
 *    includes text/comment nodes and lags behind collection, so it reports ~1300
 *    phantom "detached" nodes on a page whose true detached count is zero, and it drifts
 *    non-monotonically. `detachedness` is Chrome's own per-node verdict (1=attached,
 *    2=detached).
 *
 * 4. **Fit a slope over a series rather than trusting one before/after pair.** Baselines
 *    vary by hundreds of nodes between runs, so a single delta cannot distinguish a leak
 *    from noise. A real leak is a straight line; noise is a flat scatter. Sampling every
 *    two renders also exposes one-time warm-up costs (a first-render cache fill shows as a
 *    single step, then flat) which a two-point delta would misreport as a leak.
 *
 * The metric was validated by injecting a known leak (1000 deliberately detached nodes):
 * it reported +1005 and returned to baseline when the references were dropped. A leak
 * metric that has not been shown to fail on a real leak cannot be trusted to pass.
 *
 * ── What this guards ──
 * A store subscription created without `takeUntil(this.unsubscribe$)` never completes, so
 * every render of a section leaks a live subscription that pins the destroyed component's
 * entire DOM subtree. That shape is measurable here as a straight-line slope of retained
 * detached nodes per render, accompanied by steady heap growth with no plateau; a correctly
 * torn-down subscription yields a slope of 0.0 and a flat heap. The threshold below sits far
 * enough under a real leak's magnitude to catch a dropped `takeUntil` in any MSEL section.
 */
test.describe('Performance and Optimization', () => {
  let token: string;
  let mselId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token, {
      name: tempBlueprintName('TestBP-MemLeak'),
      description: 'Seeded to measure retained DOM across MSEL section switches.',
    });
    mselId = msel.id;
  });

  test.afterEach(async () => {
    if (mselId) {
      try {
        await deleteMsel(token, mselId);
      } catch (err) {
        console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
      }
    }
  });

  test('Memory Leak Detection', async ({ blueprintAuthenticatedPage: page, context }) => {
    const client = await context.newCDPSession(page);
    await client.send('Performance.enable');

    /**
     * Force a full GC, then count nodes Chrome itself reports as detached.
     */
    const sample = async () => {
      await client.send('HeapProfiler.collectGarbage');

      const chunks: string[] = [];
      const onChunk = (e: { chunk: string }) => chunks.push(e.chunk);
      client.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
      await client.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
      client.off('HeapProfiler.addHeapSnapshotChunk', onChunk);

      const snapshot = JSON.parse(chunks.join(''));
      const nodeFields: string[] = snapshot.snapshot.meta.node_fields;
      const stride = nodeFields.length;
      const detachednessIdx = nodeFields.indexOf('detachedness');
      expect(
        detachednessIdx,
        'heap snapshot has no `detachedness` node field; this Chromium cannot report ' +
          'detached nodes and the measurement would be vacuous'
      ).toBeGreaterThanOrEqual(0);

      let detached = 0;
      for (let i = 0; i < snapshot.nodes.length; i += stride) {
        // 0 = unknown, 1 = attached, 2 = detached
        if (snapshot.nodes[i + detachednessIdx] === 2) detached++;
      }

      const metrics = await client.send('Performance.getMetrics');
      const metric = (name: string) =>
        metrics.metrics.find((m) => m.name === name)?.value ?? 0;

      return { detached, heapMb: metric('JSHeapUsedSize') / 1024 / 1024 };
    };

    /**
     * Switch sections and prove the new one rendered before returning, so each iteration
     * is a genuine mount/destroy rather than a click the app may not have processed yet.
     * `msel.component.ts` `getListItemClass()` returns 'selected-item' for the active tab
     * and 'non-selected-item' otherwise, so that class flip is an app-owned signal that
     * the switch completed — no fixed sleep needed.
     */
    const openSection = async (section: string) => {
      const item = page.locator('mat-list-item').filter({ hasText: section }).first();
      await item.click();
      // Anchored on word boundaries: a bare /selected-item/ would also match the inactive
      // state's 'non-selected-item' and the wait would pass immediately.
      await expect(item).toHaveClass(/(^|\s)selected-item(\s|$)/, { timeout: 15000 });
    };

    await navigateToMsel(page, mselId);

    // Toggle Info against a second section so each iteration destroys and recreates the
    // Info component — the ordinary user action a component must survive without
    // retaining its DOM.
    const partner = 'Contributors';

    // Warm up once so first-render lazy work (cache fills, one-time template
    // instantiation) is charged to the baseline rather than counted as a leak.
    await openSection(partner);
    await openSection('Info');
    await openSection(partner);

    const blocks = 6;
    const rendersPerBlock = 2;
    const series: Array<{ renders: number; detached: number; heapMb: number }> = [];

    series.push({ renders: 0, ...(await sample()) });

    for (let block = 1; block <= blocks; block++) {
      for (let i = 0; i < rendersPerBlock; i++) {
        await openSection('Info');
        await openSection(partner);
      }
      series.push({ renders: block * rendersPerBlock, ...(await sample()) });
    }

    for (const point of series) {
      console.log(
        `renders=${String(point.renders).padStart(2)} ` +
          `detached=${String(point.detached).padStart(5)} ` +
          `heap=${point.heapMb.toFixed(2)}MB`
      );
    }

    // Least-squares slope of detached nodes against render count. A leak is a straight
    // line with positive slope; stable memory is flat regardless of the absolute count.
    const n = series.length;
    const meanRenders = series.reduce((a, p) => a + p.renders, 0) / n;
    const meanDetached = series.reduce((a, p) => a + p.detached, 0) / n;
    const slope =
      series.reduce((a, p) => a + (p.renders - meanRenders) * (p.detached - meanDetached), 0) /
      series.reduce((a, p) => a + (p.renders - meanRenders) ** 2, 0);

    const totalRenders = blocks * rendersPerBlock;
    console.log(`slope=${slope.toFixed(1)} detached nodes/render over ${totalRenders} renders`);

    // expect: destroyed section components release their DOM.
    //
    // Threshold rationale: a correctly torn-down subscription measures 0.0, while a leaked
    // one runs into the hundreds of nodes per render. 50 is an order of magnitude below a
    // real leak while leaving room for a one-time warm-up step that survived the warm-up
    // cycle above (a single step across the series contributes a small positive slope
    // without being unbounded growth).
    expect(
      slope,
      `Info section retains ~${slope.toFixed(0)} detached DOM nodes per render ` +
        `(${series[0].detached} → ${series[n - 1].detached} over ${totalRenders} renders). ` +
        `These survived a forced GC, so a live reference is pinning them. The usual cause ` +
        `is a store subscription created without takeUntil(this.unsubscribe$), which keeps ` +
        `the destroyed component's DOM alive.`
    ).toBeLessThan(50);

    // expect: no unbounded heap growth from the same cause — a leaked subscription drives
    // steady per-render heap growth with no plateau.
    const heapGrowth = series[n - 1].heapMb - series[0].heapMb;
    expect(
      heapGrowth,
      `heap grew ${heapGrowth.toFixed(2)}MB across ${totalRenders} Info renders`
    ).toBeLessThan(5);

    await client.detach();
  });
});
