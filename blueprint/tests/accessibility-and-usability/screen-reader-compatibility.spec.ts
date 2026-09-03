// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Test: Screen Reader Compatibility (plan item 16.x)
//
// Now asserts unconditionally, with its assertions intact, rather than a bare `test.fixme()`.
// It used to fail against a real app defect, which has since been fixed in `blueprint.ui`.
//
// Measured on the running app after the shell renders, BEFORE the fix:
//
//   route        headings                 landmarks   unnamed   document.title
//   /            none                     none        0         Event Dashboard
//   /build       none                     none        4         Blueprint
//   /admin       H2:Administration        none        1         Blueprint Admin
//
// A repo-wide grep confirmed landmarks were absent everywhere: no `role="main"`/`navigation`/
// `banner`/`contentinfo` and no <main>/<nav>/<header>/<footer> in any template. Structure was
// carried entirely by mat-toolbar / mat-card-title, which convey nothing to assistive tech.
//
// PARTIAL CORRECTION to the previous comment, which said the app "does not use semantic HTML
// heading elements (h1-h6)". Too strong: the templates contain 3 <h1>, 10 <h2>, 4 <h3> and
// 5 <h4>. They were simply absent from the primary surfaces — the dashboard and /build had
// none. The landmark half of the claim was fully correct.
//
// What changed in `blueprint.ui`:
//
//   * `app.component.html` — the router outlet is wrapped in <main class="app-main">, so every
//     route has a main landmark. The wrapper carries the flex layout the routed component's
//     :host expects, so it is layout-neutral.
//   * `topbar.component.html` — `role="banner"` on the toolbar, and the title span became
//     `<h1 class="view-text">`. Material styles headings inside a toolbar to the toolbar's own
//     font, so it renders identically to the span it replaced. This is the page's single h1;
//     `home-app`'s API-error heading and `manage`'s "This event has ended" were demoted to <h2>
//     so the count stays exactly 1 in those states too.
//   * `admin-container.component.html` — `role="navigation"` + an aria-label on the section
//     sidenav; mat-sidenav carries no landmark role of its own. `<h2>Administration</h2>` is
//     untouched (four specs locate it by role).
//   * `msel-list` / `admin-units` — `aria-label="Search"` on the search fields, which had only a
//     placeholder, and an aria-label on the MSEL row's delete button, whose tooltip lives on a
//     wrapping span (a disabled button fires no hover events).
//
// Note on the accessible-name check below: it is deliberately stricter than ARIA, which does
// fall back to `placeholder`. A placeholder disappears as soon as the user types, so a
// placeholder-only field is not adequately labelled even though `getByRole('textbox', { name:
// 'Search' })` matches it. The aria-label is exactly "Search", so those locators still hit.
// (A visible `<mat-label>` would have been the stronger fix — it survives typing — but it changes
// the look of every search box, so the invisible name was chosen instead.)
//
// Re-measured after the fix, at both 375px and 1920px: one h1, >=1 landmark, 0 unnamed elements
// on all three routes.
//
// The old body also asserted `expect(a || b || c).toBeTruthy()` over only the *first five*
// inputs/buttons/links, which both hides which element failed and leaves the rest unchecked.
// Rewritten to collect every offender and assert the collection is empty, so a failure names
// the actual elements.

import { test, expect, Services } from '../../fixtures';

const ROUTES = ['', '/build', '/admin'] as const;

test.describe('Accessibility and Usability', () => {
  test('Screen Reader Compatibility', async ({ blueprintAuthenticatedPage: page }) => {
    for (const route of ROUTES) {
      await page.goto(`${Services.Blueprint.UI}${route}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('app-topbar, mat-toolbar').first()).toBeVisible({
        timeout: 20000,
      });
      const where = `route "${route || '/'}"`;

      // expect: the document is titled.
      expect(await page.title(), `${where}: document.title`).toBeTruthy();

      // expect: at least one heading, and exactly one h1 as the page's main heading.
      await expect(
        page.locator('h1, h2, h3, h4, h5, h6'),
        `${where}: page must expose at least one heading`
      ).not.toHaveCount(0);
      await expect(page.locator('h1'), `${where}: page must have exactly one h1`).toHaveCount(1);

      // expect: at least one ARIA landmark so a screen-reader user can skip to content.
      await expect(
        page.locator(
          '[role="main"], [role="navigation"], [role="banner"], [role="complementary"], ' +
            '[role="contentinfo"], main, nav, header, aside, footer'
        ),
        `${where}: page must expose at least one ARIA landmark`
      ).not.toHaveCount(0);

      // expect: every visible interactive element has an accessible name. Collected rather
      // than sampled, so a failure reports exactly which elements are unnamed.
      const unnamed = await page.evaluate(() => {
        const offenders: Array<{ tag: string; cls: string; why: string }> = [];
        const visible = (el: Element) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };
        const describe = (el: Element, why: string) => ({
          tag: el.tagName,
          cls: (el as HTMLElement).className?.toString().slice(0, 40) ?? '',
          why,
        });

        for (const el of Array.from(document.querySelectorAll('button, a'))) {
          if (!visible(el)) continue;
          const named =
            (el.textContent ?? '').trim() ||
            el.getAttribute('aria-label') ||
            el.getAttribute('title') ||
            el.getAttribute('aria-labelledby');
          if (!named) offenders.push(describe(el, 'no accessible name'));
        }

        for (const el of Array.from(
          document.querySelectorAll('input:not([type=hidden]), textarea, select')
        )) {
          if (!visible(el)) continue;
          const id = el.getAttribute('id');
          const labelled =
            el.getAttribute('aria-label') ||
            el.getAttribute('aria-labelledby') ||
            (id && document.querySelector(`label[for="${id}"]`)) ||
            el.closest('label') ||
            el.closest('mat-form-field')?.querySelector('mat-label');
          if (!labelled) offenders.push(describe(el, 'form control has no label'));
        }

        return offenders.slice(0, 15);
      });

      expect(unnamed, `${where}: interactive elements without accessible names`).toEqual([]);
    }
  });
});
