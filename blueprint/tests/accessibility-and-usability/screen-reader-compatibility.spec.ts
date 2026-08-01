// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Test: Screen Reader Compatibility (plan item 16.x)
//
// Now `test.skip`-ed against BP-12 with its assertions intact, rather than a bare
// `test.fixme()`.
//
// Measured on the running app after the shell renders:
//
//   route        headings                 landmarks   document.title
//   /            none                     none        Event Dashboard
//   /build       none                     none        Blueprint
//   /admin       H2:Administration        none        Blueprint Admin
//
// A repo-wide grep confirms landmarks are absent everywhere: no `role="main"`/`navigation`/
// `banner`/`contentinfo` and no <main>/<nav>/<header>/<footer> in any template. Structure is
// carried entirely by mat-toolbar / mat-card-title, which convey nothing to assistive tech.
//
// PARTIAL CORRECTION to the previous comment, which said the app "does not use semantic HTML
// heading elements (h1-h6)". Too strong: the templates contain 3 <h1>, 10 <h2>, 4 <h3> and
// 5 <h4>. They are simply absent from the primary surfaces — the dashboard and /build have
// none. The landmark half of the claim is fully correct. Filed as BP-12.
//
// The old body also asserted `expect(a || b || c).toBeTruthy()` over only the *first five*
// inputs/buttons/links, which both hides which element failed and leaves the rest unchecked.
// Rewritten to collect every offender and assert the collection is empty, so a failure names
// the actual elements.

import { test, expect, Services } from '../../fixtures';

const ROUTES = ['', '/build', '/admin'] as const;

test.describe('Accessibility and Usability', () => {
  test('Screen Reader Compatibility', async ({ blueprintAuthenticatedPage: page }) => {
    test.skip(
      true,
      'BP-12: no ARIA landmarks on any route, and the dashboard and /build render no headings ' +
        'at all (see blueprint/blueprint-app-bugs.md)'
    );

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
