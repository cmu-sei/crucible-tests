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
} from '../../test-helpers';

const readIsDark = (page: Page) => page.evaluate(() => document.body.classList.contains('darkMode'));

async function expectNoContrastViolations(page: Page, screen: string) {
  const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  const detail = results.violations
    .flatMap((v) => v.nodes)
    .map((n) => `  ${n.target.join(' ')}: ${n.any[0]?.message ?? n.failureSummary}`)
    .join('\n');
  expect(results.violations, `${screen} has contrast violations:\n${detail}`).toEqual([]);
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
      await expect(page.getByText('Manage an Event').first()).toBeVisible({ timeout: 30000 });
      await expectNoContrastViolations(page, `${theme} dashboard`);

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
