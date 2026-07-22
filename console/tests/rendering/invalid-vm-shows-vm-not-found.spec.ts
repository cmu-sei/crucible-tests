// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: console/console-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

const INVALID_VM_ID = '00000000-0000-0000-0000-000000000000';

test.describe('Console Rendering', () => {
  // Inverse of the render-without-focus test: a console route for a VM that
  // does not exist must show the "VM Not Found" page, and it must do so
  // without requiring window focus.
  test('Console shows "VM Not Found" for an invalid VM id', async ({
    consoleAuthenticatedPage: page,
  }) => {
    // 1. Navigate to the console route for a VM id that does not exist
    await page.goto(`${Services.Console.UI}/vm/${INVALID_VM_ID}/console`);

    // 2. The VM-not-found page is shown
    await expect(
      page.getByRole('heading', { name: 'VM Not Found' })
    ).toBeVisible({ timeout: 30000 });

    // 3. ...and the live console component is not rendered for a missing VM
    await expect(page.locator('app-console')).toHaveCount(0);
  });
});
