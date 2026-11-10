// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services, BLUEPRINT_THEMES, applyBlueprintTheme } from '../../fixtures';
import { getBlueprintToken, createMsel, deleteMsel, tempBlueprintName } from '../../test-helpers';

/**
 * The stand-alone MSEL page (`/mselpage/:id`) draws the page on the theme background from edge
 * to edge, with no band of bare body above or below it.
 *
 * The page's 1cm margins once collapsed through `.article-container`, so the background began
 * 1cm below the top of the scroll area and ended 1cm above its bottom, leaving a white band
 * at each end (stark on dark, faint on light).
 *
 * DOM notes from `msel-page.component.html`: the component host scrolls, `.article-container`
 * paints the theme background, and `.page` is the sheet inside it.
 */
for (const theme of BLUEPRINT_THEMES) {
  test.describe(`${theme} theme › MSEL Info Pages Management`, () => {
    let token: string;
    let mselId: string;
    let pageId: string;

    test.beforeEach(async () => {
      token = await getBlueprintToken();
      const msel = await createMsel(token);
      mselId = msel.id;

      const res = await fetch(`${Services.Blueprint.API}/api/mselpages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mselId,
          name: tempBlueprintName('TestBP-Page'),
          content: '<p>Seeded page content</p>',
          allCanView: true,
          includeInPlaybook: false,
        }),
      });
      expect(res.ok, `seeding MSEL page failed with ${res.status}`).toBe(true);
      pageId = (await res.json()).id;
    });

    test.afterEach(async () => {
      try {
        if (pageId) {
          await fetch(`${Services.Blueprint.API}/api/mselpages/${pageId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch (err) {
        console.warn(`Cleanup failed for MSEL page ${pageId}: ${err}`);
      }
      try {
        if (mselId) await deleteMsel(token, mselId);
      } catch (err) {
        console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
      }
    });

    test('MSEL page background reaches the top and bottom', async ({ blueprintAuthenticatedPage: page }) => {
      await applyBlueprintTheme(page, theme);
      await page.goto(`${Services.Blueprint.UI}/mselpage/${pageId}`);

      const sheet = page.locator('.article-container .page');
      await expect(sheet).toContainText('Seeded page content', { timeout: 15000 });

      // Offsets within the scrolling host, so the result does not depend on the banner above it.
      const layout = await sheet.evaluate((el) => {
        const container = el.parentElement!;
        const host = container.parentElement!;
        const hostTop = host.getBoundingClientRect().top - host.scrollTop;
        const top = (e: Element) => e.getBoundingClientRect().top - hostTop;
        const bottom = (e: Element) => e.getBoundingClientRect().bottom - hostTop;
        return {
          containerTop: top(container),
          containerBottom: bottom(container),
          scrollHeight: host.scrollHeight,
          sheetTop: top(el),
          sheetBottom: bottom(el),
        };
      });

      // expect: the background starts at the top of the scroll area and ends at its bottom.
      expect(layout.containerTop).toBeCloseTo(0, 0);
      expect(layout.containerBottom).toBeCloseTo(layout.scrollHeight, 0);
      // expect: the sheet's margins sit inside the background.
      expect(layout.sheetTop).toBeGreaterThan(layout.containerTop + 30);
      expect(layout.containerBottom).toBeGreaterThan(layout.sheetBottom + 30);
    });
  });
}
