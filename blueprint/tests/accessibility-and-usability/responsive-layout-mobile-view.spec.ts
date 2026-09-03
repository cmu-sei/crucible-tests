// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Test: Responsive Layout - Mobile View (plan item 16.x)
//
// Rewritten, with its assertion intact. It used to fail against a real app defect, which has
// since been fixed in `blueprint.ui` (see below).
//
// The previous version was a bare `test.fixme()` whose comment claimed
// "document.body.scrollWidth is ~466px at a 375px mobile viewport". Measured directly on the
// running app, `body.scrollWidth` is **375**, not 466 — so its central assertion,
// `expect(bodyWidth).toBeLessThanOrEqual(375)`, would have PASSED. The metric could not
// detect the very defect the comment described. (466 is the right edge of one *overflowing
// element* on the dashboard, not the document width.)
//
// The real defect, measured at 375x667: elements rendered past the right
// edge while the document did NOT scroll horizontally, so they were clipped and unreachable.
//
//   route        documentElement.scrollWidth   overflows?   widest element right edge
//   /            375                           no           466px  (div.options-text)
//   /admin       375                           no           585px
//   /build       375                           no           708px
//
// A control 333px beyond a 375px screen with no way to scroll to it is inaccessible, not
// merely ugly. The assertion below uses the metric that actually catches this — every visible
// interactive element's right edge must fall within the viewport.
//
// Three separate causes, all now fixed in `blueprint.ui` behind a `max-width: 599px` breakpoint
// (Material's own mobile toolbar breakpoint; the tablet and desktop specs run at 768 and 1920,
// so they are unaffected):
//
//   * `topbar.component.scss` — `.view-text` had `margin-left: 50px; margin-right: 40px` and no
//     `min-width: 0` inside a `white-space: nowrap` toolbar row, so the title's full width was
//     its *minimum* width and it shoved the account menu (Administration / Logout / Dark Theme)
//     off the right edge. The title now ellipsizes, the gutters shrink to 12px, and the user's
//     name is hidden below the breakpoint, leaving the chevron. That was the 466px offender on
//     `/` and part of the 708px one on `/build`.
//   * `msel-list.component.*` — the search box was an inline `width: 320px` inside a container
//     that is `width: 80%`, on a `flex-wrap: nowrap` 90px row. It is now `max-width: 100%`, the
//     row wraps, and the container takes the full width below the breakpoint.
//   * `admin-container.component.ts` — `/admin`'s 250px navigation panel left a phone ~125px of
//     content, pushing the section's toolbar buttons and paginator off-screen. It now collapses
//     to its 50px icon rail below the breakpoint via `BreakpointObserver` — the rail already
//     existed but was reachable only from a button inside itself.
//
// Re-measured after the fix: 0 overflowing interactive elements on all three routes at 375px,
// with `scrollWidth == clientWidth == 375`.
//
// The old body also wrapped nearly every check in `if (count > 0)` / `if (box)`, so on a page
// where the elements were missing it asserted nothing at all. Those guards are gone.

import { test, expect, Services } from '../../fixtures';

const MOBILE = { width: 375, height: 667 };

test.describe('Accessibility and Usability', () => {
  test('Responsive Layout - Mobile View', async ({ blueprintAuthenticatedPage: page }) => {
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
