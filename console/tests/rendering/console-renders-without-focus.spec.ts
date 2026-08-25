// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: console/console-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { seedViewWithVm, SeededViewWithVm } from '../../../playerVm/vm-helpers';

test.describe('Console Rendering', () => {
  // The console route needs a VM the authenticated user can read. This spec
  // seeds its own — a discovered VM would make the test conditional on whatever
  // the environment holds, and "no VM found" would then report green while
  // asserting nothing about rendering. A seeded VM has `Type=Unknown`, which
  // console.ui's template handles on the same branch as vSphere, so the console
  // shell mounts exactly as it does for a real machine (it just never connects
  // to a screen, which nothing below depends on).
  let seeded: SeededViewWithVm;

  test.beforeAll(async () => {
    seeded = await seedViewWithVm('E2E Console Rendering');
  });

  test.afterAll(async () => {
    await seeded?.cleanup();
  });

  // Regression: the console did not render until the window was clicked/focused
  // because readOnly$ (bound via | async in an OnPush component) was assigned
  // late, so change detection only ran on a window:focus event (console.ui
  // #732). This test navigates to the console and asserts the component renders
  // without any click or focus interaction.
  test('Console renders without window focus', async ({
    consoleAuthenticatedPage: page,
  }) => {
    // 1. Open the console route directly. Do not click or focus anything after
    //    this — the component must render on its own.
    await page.goto(`${Services.Console.UI}/vm/${seeded.vmId}/console`);

    // 2. The console component renders without interaction. app-console is the
    //    options bar + screen/overlay host; before the fix this stayed as bare
    //    Angular placeholder comments until a window:focus event fired.
    await expect(page.locator('app-console')).toBeVisible({ timeout: 30000 });

    // 3. Sanity-check that real content rendered inside it (options bar and/or
    //    the connecting overlay), not an empty host. Any one of these proves
    //    change detection ran without a focus event.
    const consoleContent = page.locator(
      'app-options-bar, app-options-bar2, app-novnc, #wmksContainer, #screen'
    );
    await expect(consoleContent.first()).toBeAttached({ timeout: 30000 });

    // 4. The valid-VM console must not be showing the not-found page. That page
    //    is what a 403/404 on the VM lookup produces, so this also confirms the
    //    seeded VM is readable by the browser session, not just by the seeding
    //    token.
    await expect(
      page.getByRole('heading', { name: 'VM Not Found' })
    ).toHaveCount(0);
  });
});
