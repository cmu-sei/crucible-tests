// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: console/console-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoConsole, CONSOLE_THEMES } from '../../fixtures';

for (const theme of CONSOLE_THEMES) {
  test.describe(`${theme} theme › Console Rendering`, () => {
    // Regression: the console did not render until the window was clicked/focused
    // because readOnly$ (bound via | async in an OnPush component) was assigned
    // late, so change detection only ran on a window:focus event (console.ui
    // #732). This test navigates to the console and asserts the component renders
    // without any click or focus interaction.
    test('Console renders without window focus', async ({
      consoleAuthenticatedPage: page,
      consoleVm: vm,
    }) => {
      // 1. Open the console route for the seeded VM record directly. Do not click
      //    or focus anything after this — the component must render on its own.
      //    The record has no hypervisor behind it, so the console never connects;
      //    that is fine, the test is about the component rendering.
      await gotoConsole(page, `/vm/${vm.id}/console`, theme);

      // 2. The console component renders without interaction. app-console is the
      //    options bar + screen/overlay host; before the fix this stayed as bare
      //    Angular placeholder comments until a window:focus event fired.
      await expect(page.locator('app-console')).toBeVisible({ timeout: 30000 });

      // 3. Real content rendered inside it: the options bar with its "Console
      //    options" gear menu button, and the connecting overlay (the seeded record
      //    has no hypervisor VM, so it never connects).
      const optionsBar = page.locator('app-options-bar, app-options-bar2').first();
      await expect(optionsBar).toBeVisible({ timeout: 30000 });
      await expect(optionsBar.getByRole('button', { name: 'Console options' })).toBeVisible();
      await expect(page.locator('app-console').getByText(/Connecting/)).toBeVisible({ timeout: 30000 });

      // 4. The valid-VM console must not be showing the not-found page.
      await expect(page.getByRole('heading', { name: 'VM Not Found' })).toHaveCount(0);
    });
  });
}
