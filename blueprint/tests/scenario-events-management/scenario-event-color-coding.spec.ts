// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts
//
// Row highlighting is a rendering concern: the colour is stored in the event's `rowMetadata`
// ("<height>,<r>,<g>,<b>"), and ScenarioEventListComponent.getRowStyle turns it into an inline
// `rgba(r, g, b, <theme tint>)` background on the row. The swatches in the Highlight menu are
// styled by the same getStyleFromColor, so a correctly highlighted row has exactly the computed
// background of the swatch that was clicked. That the PUT is accepted is the API suite's job.
//
// The menu's first option is the "no colour" swatch — the previous version of this spec clicked
// it, so it cleared a highlight that was never set and then asserted only the PUT's 200.

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  createRenderableScenarioEvent,
  navigateToMselSection,
  findScenarioEventRow,
  tempBlueprintName,
} from '../../test-helpers';

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

test.describe('Scenario Events Management', () => {
  let token: string;
  let mselId: string | undefined;
  const eventText = tempBlueprintName('ColorCoding');

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    mselId = (await createMsel(token)).id;
    await createRenderableScenarioEvent(token, mselId, eventText, { deltaSeconds: 300 });
  });

  test.afterEach(async () => {
    if (mselId) await deleteMsel(token, mselId);
  });

  test('Scenario Event Color Coding', async ({ blueprintAuthenticatedPage: page }) => {
    await navigateToMselSection(page, mselId!, 'Scenario Events');
    const row = await findScenarioEventRow(page, eventText);
    const rowBackground = () => row.evaluate((el) => getComputedStyle(el).backgroundColor);

    // expect: an unhighlighted row has no background of its own.
    expect(await rowBackground()).toBe(TRANSPARENT);

    const openHighlightMenu = async () => {
      await row.getByRole('button', { name: /Action List/i }).click();
      await page.getByRole('menuitem', { name: /^Highlight$/ }).click();
      const swatches = page.locator('.mat-mdc-menu-panel button.color-option-button');
      await expect(swatches.nth(1)).toBeVisible({ timeout: 5000 });
      return swatches;
    };

    // 1. Highlight the row with the first real colour (index 0 is "no colour").
    let swatches = await openHighlightMenu();
    const swatchColor = await swatches
      .nth(1)
      .locator('.color-option')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(swatchColor, 'the swatch should render a colour').not.toBe(TRANSPARENT);
    await swatches.nth(1).click();

    // expect: the row renders in the swatch's colour.
    await expect.poll(rowBackground, { timeout: 10000 }).toBe(swatchColor);

    // 2. Reload: the highlight is rendered from the stored rowMetadata, not local state.
    await page.reload();
    await expect(page.locator('mat-list-item').filter({ hasText: 'Info' }).first()).toBeVisible({
      timeout: 30000,
    });
    await page.locator('mat-list-item').filter({ hasText: 'Scenario Events' }).first().click();
    await findScenarioEventRow(page, eventText);
    await expect.poll(rowBackground, { timeout: 15000 }).toBe(swatchColor);

    // 3. Clear it with the "no colour" swatch.
    swatches = await openHighlightMenu();
    await swatches.nth(0).click();

    // expect: the row is back to no background.
    await expect.poll(rowBackground, { timeout: 10000 }).toBe(TRANSPARENT);
  });
});
