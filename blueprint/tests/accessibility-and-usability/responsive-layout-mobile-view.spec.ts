// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Test: Responsive Layout - Mobile View (plan item 16.x)
//
// Rewritten, and now `test.skip`-ed pending upstream support, with its assertion intact.
//
// The previous version was a bare `test.fixme()` whose comment claimed
// "document.body.scrollWidth is ~466px at a 375px mobile viewport". Measured directly on the
// running app, `body.scrollWidth` is **375**, not 466 — so its central assertion,
// `expect(bodyWidth).toBeLessThanOrEqual(375)`, would have PASSED. The metric could not
// detect the very defect the comment described. (466 is the right edge of one *overflowing
// element* on the dashboard, not the document width.)
//
// The real defect, measured at 375x667: elements render past the right
// edge while the document does NOT scroll horizontally, so they are clipped and unreachable.
//
//   route        documentElement.scrollWidth   overflows?   widest element right edge
//   /            375                           no           466px  (div.options-text)
//   /admin       375                           no           585px
//   /build       375                           no           708px
//
// A control 333px beyond a 375px screen with no way to scroll to it is inaccessible, not
// merely ugly. The assertion below uses the metric that actually catches this — every visible
// interactive element's right edge must fall within the viewport — so it fails today and will
// pass once a breakpoint is added.
//
// The old body also wrapped nearly every check in `if (count > 0)` / `if (box)`, so on a page
// where the elements were missing it asserted nothing at all. Those guards are gone.

import { test, expect, Services } from '../../fixtures';

const MOBILE = { width: 375, height: 667 };

test.describe('Accessibility and Usability', () => {
  test('Responsive Layout - Mobile View', async ({ blueprintAuthenticatedPage: page }) => {
    test.skip(
      true,
      'Pending upstream support: reachable controls at a 375px mobile viewport'
    );

    await page.setViewportSize(MOBILE);

    for (const route of ['', '/build', '/admin']) {
      await page.goto(`${Services.Blueprint.UI}${route}`, { waitUntil: 'domcontentloaded' });

      // Wait for the shell so layout has settled before measuring — not a sleep.
      await expect(page.locator('app-topbar, mat-toolbar').first()).toBeVisible({
        timeout: 20000,
      });

      // expect: nothing the user is meant to interact with sits outside the viewport.
      const overflowing = await page.evaluate((viewportWidth) => {
        const interactive = Array.from(
          document.querySelectorAll('button, a, input, textarea, select')
        );
        return interactive
          .filter((el) => {
            const r = el.getBoundingClientRect();
            const visible = r.width > 0 && r.height > 0;
            return visible && Math.round(r.right) > viewportWidth;
          })
          .map((el) => ({
            tag: el.tagName,
            cls: (el as HTMLElement).className?.toString().slice(0, 40) ?? '',
            right: Math.round(el.getBoundingClientRect().right),
          }))
          .slice(0, 10);
      }, MOBILE.width);

      expect(
        overflowing,
        `route "${route || '/'}": interactive elements extend past the ${MOBILE.width}px viewport`
      ).toEqual([]);

      // expect: and where content does overflow, the page must at least be scrollable to it.
      // Both conditions failing together is what makes this an accessibility defect rather
      // than a cosmetic one.
      const { docScrollWidth, clientWidth } = await page.evaluate(() => ({
        docScrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(
        docScrollWidth,
        `route "${route || '/'}": document must not require horizontal scrolling`
      ).toBeLessThanOrEqual(clientWidth);
    }
  });
});
