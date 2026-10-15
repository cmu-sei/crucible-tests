// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Keyboard-only operation of the MSEL list and the event dashboard. The previous version of
// this spec gated every assertion behind `if (!focusInfo.isBody)` and never asserted that
// Enter did anything, so it passed whatever the page did.

import type { Page } from '@playwright/test';
import { test, expect, Services } from '../../fixtures';

/**
 * Tag the focused element with the step number and describe it. The tag gives each stop an
 * identity that survives re-renders of its text, so Shift+Tab can be checked against the
 * exact element Tab visited rather than something that merely looks like it.
 */
const markFocus = (page: Page, step: number) =>
  page.evaluate((n) => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { isBody: true, visible: false, alreadyVisited: false };
    const alreadyVisited = el.hasAttribute('data-kbd-step');
    if (!alreadyVisited) el.setAttribute('data-kbd-step', String(n));
    const rect = el.getBoundingClientRect();
    return { isBody: false, visible: rect.width > 0 && rect.height > 0, alreadyVisited };
  }, step);

const focusedStep = (page: Page) =>
  page.evaluate(() => document.activeElement?.getAttribute('data-kbd-step') ?? null);

test.describe('Accessibility and Usability', () => {
  test('Keyboard Navigation', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Open the MSEL list and wait for its controls.
    await page.goto(`${Services.Blueprint.UI}/build`);
    const search = page.getByRole('textbox', { name: 'Search' });
    await expect(page.getByRole('button', { name: 'Add blank MSEL' })).toBeVisible({
      timeout: 30000,
    });
    await expect(search).toBeVisible();

    // 2. Tab forward from the top of the page.
    //    expect: every Tab lands on a new, visible element (no trap, no hidden stops), and
    //    the Search box is one of them.
    const stops = 12;
    let searchStep: number | undefined;
    for (let step = 1; step <= stops; step++) {
      await page.keyboard.press('Tab');
      const focus = await markFocus(page, step);
      expect(focus.isBody, `Tab ${step} should focus an element, not the page`).toBe(false);
      expect(focus.alreadyVisited, `Tab ${step} should reach an element not yet visited`).toBe(
        false
      );
      expect(focus.visible, `Tab ${step} should focus a visible element`).toBe(true);
      if (searchStep === undefined && (await search.evaluate((el) => el === document.activeElement))) {
        searchStep = step;
      }
    }
    expect(searchStep, 'the Search box should be reachable by Tab').toBeDefined();

    // 3. Shift+Tab back three stops.
    //    expect: focus retraces the forward order exactly.
    for (let step = stops - 1; step >= stops - 3; step--) {
      await page.keyboard.press('Shift+Tab');
      expect(await focusedStep(page), `Shift+Tab should return to Tab stop ${step}`).toBe(
        String(step)
      );
    }

    // 4. Activate the Name column's sort header with Enter, three times.
    //    expect: each press changes the sort, and both directions are reached (Material
    //    cycles ascending -> descending -> unsorted).
    const nameHeader = page.getByRole('columnheader', { name: 'Name' });
    await nameHeader.getByRole('button').focus();
    const seen: string[] = [];
    let previous = (await nameHeader.getAttribute('aria-sort')) ?? 'none';
    for (let press = 1; press <= 3; press++) {
      await page.keyboard.press('Enter');
      await expect(nameHeader, `Enter ${press} should change the sort`).not.toHaveAttribute(
        'aria-sort',
        previous
      );
      previous = (await nameHeader.getAttribute('aria-sort')) ?? 'none';
      seen.push(previous);
    }
    expect(seen).toEqual(expect.arrayContaining(['ascending', 'descending']));
  });

  test('Dashboard Cards Are Keyboard Reachable', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Open the event dashboard.
    await page.goto(Services.Blueprint.UI);
    const manageCard = page.getByRole('button', { name: /Manage an Event/ });
    await expect(manageCard).toBeVisible({ timeout: 30000 });

    // 2. Tab from the top of the page.
    //    expect: the card is reached (its positive tabindex puts it before the topbar).
    let reached = false;
    for (let step = 0; step < 5 && !reached; step++) {
      await page.keyboard.press('Tab');
      reached = await manageCard.evaluate((el) => el === document.activeElement);
    }
    expect(reached, 'Tab should reach the Manage an Event card').toBe(true);

    // 3. Press Enter, then Space, on the focused card.
    // Pending upstream: the dashboard cards are `<mat-card role="button" tabindex="…">` with
    // only a `(click)` binding, so neither Enter nor Space activates them (WCAG 2.1.1) —
    // a keyboard user can focus "Manage an Event" but cannot open it. The listener below
    // records any click the key presses synthesise; a native button dispatches that click
    // before `keyboard.press` resolves, so no wait is needed. When the cards get a
    // `(keydown.enter)`/`(keydown.space)` handler (or become real buttons), flip this to
    // expect the press to navigate to /build.
    await manageCard.evaluate((el) => {
      (window as unknown as { cardClicks: number }).cardClicks = 0;
      el.addEventListener('click', () => (window as unknown as { cardClicks: number }).cardClicks++);
    });
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    expect(
      await page.evaluate(() => (window as unknown as { cardClicks: number }).cardClicks)
    ).toBe(0);
    await expect(page).not.toHaveURL(/\/build/);
  });
});
