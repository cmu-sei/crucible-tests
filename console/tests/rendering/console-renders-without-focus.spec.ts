// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: console/console-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getFirstVmId } from '../../fixtures';

test.describe('Console Rendering', () => {
  // Regression: the console did not render until the window was clicked/focused
  // because readOnly$ (bound via | async in an OnPush component) was assigned
  // late, so change detection only ran on a window:focus event (console.ui
  // #732). This test navigates to the console and asserts the component renders
  // without any click or focus interaction.
  test('Console renders without window focus', async ({
    consoleAuthenticatedPage: page,
  }) => {
    // 1. Discover a real VM id from the first available view
    const vmId = await getFirstVmId(page);
    test.skip(!vmId, 'No VMs available for the admin user to test against');

    // 2. Open the console route directly. Do not click or focus anything after
    //    this — the component must render on its own.
    await page.goto(`${Services.Console.UI}/vm/${vmId}/console`);

    // 3. The console component renders without interaction. app-console is the
    //    options bar + screen/overlay host; before the fix this stayed as bare
    //    Angular placeholder comments until a window:focus event fired.
    await expect(page.locator('app-console')).toBeVisible({ timeout: 30000 });

    // 4. Sanity-check that real content rendered inside it (options bar and/or
    //    the connecting overlay), not an empty host. Any one of these proves
    //    change detection ran without a focus event.
    const consoleContent = page.locator(
      'app-options-bar, app-options-bar2, app-novnc, #wmksContainer, #screen'
    );
    await expect(consoleContent.first()).toBeAttached({ timeout: 30000 });

    // 5. The valid-VM console must not be showing the not-found page.
    await expect(
      page.getByRole('heading', { name: 'VM Not Found' })
    ).toHaveCount(0);
  });
});
