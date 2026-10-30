// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// WCAG AA colour contrast, checked by axe-core's `color-contrast` rule on each of the main
// screens, in both themes. axe resolves each text node's effective backdrop (stacking,
// opacity, overlapping elements), which the hand-rolled luminance maths this spec used to
// carry could not: that version measured containers that render no text, and gated its button,
// link and topbar checks on selectors that matched nothing, so most of it never asserted.
//
// Every page is asserted to have zero violations *and* some passing nodes, so an empty or
// half-rendered page cannot pass vacuously.

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createRenderableScenarioEvent,
  navigateToMselSection,
  findScenarioEventRow,
  tempBlueprintName,
  dashboardCard,
} from '../../test-helpers';

const DASHBOARD_PENDING = ['join-card', 'build-card', 'assess-card'].map(
  (card) => `.${card} > .card-footer > .mat-primary[color="primary"] > .mdc-button__label`
);

const LEARN_MORE_HOVERED_PENDING = '.value-card[role="button"]:nth-child(1) > .learn-more > span';

const readIsDark = (page: Page) => page.evaluate(() => document.body.classList.contains('darkMode'));

/**
 * Assert axe finds no contrast violations on the page, other than the `pending` ones: the
 * targets of known violations, each of which must still be reported, so the list fails once
 * the app is fixed and the entry can go.
 *
 * The pointer is moved to the page's corner first unless `keepPointer` is set, so whatever the
 * last click left it over is not measured in its hover state. Firefox keeps applying `:hover`
 * where the pointer was left across a navigation, and Chromium does not.
 */
async function expectNoContrastViolations(
  page: Page,
  screen: string,
  { pending = [], keepPointer = false }: { pending?: string[]; keepPointer?: boolean } = {}
) {
  if (!keepPointer) await page.mouse.move(0, 0);
  const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  const nodes = results.violations.flatMap((v) => v.nodes);
  const detail = nodes
    .map((n) => `  ${n.target.join(' ')}: ${n.any[0]?.message ?? n.failureSummary}`)
    .join('\n');
  expect(
    nodes.map((n) => n.target.join(' ')).sort(),
    `${screen} has contrast violations:\n${detail}`
  ).toEqual([...pending].sort());
  const checked = results.passes.reduce((sum, rule) => sum + rule.nodes.length, 0);
  expect(checked, `${screen} should have text for axe to check`).toBeGreaterThan(0);
}

test.describe('Accessibility and Usability', () => {
  let token: string;
  let mselId: string | undefined;
  const eventText = tempBlueprintName('Contrast');

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    mselId = (await createMsel(token)).id;
    await createRenderableScenarioEvent(token, mselId, eventText, { deltaSeconds: 300 });
  });

  test.afterEach(async () => {
    if (mselId) await deleteMsel(token, mselId);
  });

  test('Color Contrast Compliance', async ({ blueprintAuthenticatedPage: page }) => {
    const sweep = async (theme: string) => {
      // 1. Event dashboard.
      await page.goto(Services.Blueprint.UI);
      await expect(dashboardCard(page, 'BUILD')).toBeVisible({ timeout: 30000 });
      // Pending upstream: the mission cards' footer buttons (Join Event, Manage Events, Assess
      // Events) are primary text on the cards' --mat-sys-surface-container, short of AA's 4.5:1
      // for normal text in both themes: #0078af on #eeeeee (4.2:1) in light, #00a3ee on
      // #3d3d3d (3.86:1) in dark. Pinned here so the rest of the sweep runs; when the buttons
      // or the card background change to pass, this fails and the list should be emptied.
      await expectNoContrastViolations(page, `${theme} dashboard`, { pending: DASHBOARD_PENDING });

      // The capability cards' "Click to learn more" is transparent until its card is hovered,
      // so it is only measured with the pointer on a card, after the fade-in.
      // Pending upstream: on hover it is primary text on --mat-sys-surface-container-high, short
      // of AA's 4.5:1 for its 12px text. Pinned like the buttons above.
      const capabilityCard = page.locator('.value-card').first();
      await capabilityCard.hover();
      await expect(capabilityCard.locator('.learn-more')).toHaveCSS('opacity', '1');
      await expectNoContrastViolations(page, `${theme} dashboard, capability card hovered`, {
        pending: [...DASHBOARD_PENDING, LEARN_MORE_HOVERED_PENDING],
        keepPointer: true,
      });

      // 2. The /build MSEL list.
      await page.goto(`${Services.Blueprint.UI}/build`);
      await expect(page.getByRole('button', { name: 'Add blank MSEL' })).toBeVisible({
        timeout: 30000,
      });
      await expectNoContrastViolations(page, `${theme} MSEL list`);

      // 3. A MSEL's Info form. Opened by name: the UI remembers the last MSEL tab, so a bare
      //    navigateToMsel would land on Scenario Events in the second sweep.
      await navigateToMselSection(page, mselId!, 'Info');
      await expect(page.getByRole('textbox', { name: 'Name' })).toBeVisible({ timeout: 30000 });
      await expectNoContrastViolations(page, `${theme} MSEL info`);

      // 4. Its Scenario Events grid, with a row in it.
      await navigateToMselSection(page, mselId!, 'Scenario Events');
      await findScenarioEventRow(page, eventText);
      await expectNoContrastViolations(page, `${theme} scenario events`);

      // 5. Administration.
      await page.goto(`${Services.Blueprint.UI}/admin`);
      await expect(page.locator('mat-sidenav-content table').first()).toBeVisible({
        timeout: 30000,
      });
      await expectNoContrastViolations(page, `${theme} administration`);
    };

    await page.goto(Services.Blueprint.UI);
    await expect(page.locator('app-root mat-toolbar').first()).toBeVisible({ timeout: 30000 });
    const initiallyDark = await readIsDark(page);
    await sweep(initiallyDark ? 'dark theme' : 'light theme');

    // 6. Switch theme from the user menu and sweep again.
    await page.goto(Services.Blueprint.UI);
    await page.getByRole('button', { name: 'Admin User' }).click();
    await page.getByRole('switch', { name: 'Dark Theme' }).click();
    await expect
      .poll(() => readIsDark(page), { timeout: 15000, message: 'the theme should switch' })
      .toBe(!initiallyDark);
    await page.keyboard.press('Escape');
    await sweep(initiallyDark ? 'light theme' : 'dark theme');
  });
});
