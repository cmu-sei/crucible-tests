// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, CASTER_THEMES, setCasterTheme } from '../../fixtures';

// The switch is global: run the light and dark variants one after the other, never at once.
test.describe.configure({ mode: 'serial' });

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Global Workspace Settings`, () => {
    test('Enable Disable Workspace Operations', async ({ casterAuthenticatedPage: page }) => {
      await setCasterTheme(page, theme);

      await page.goto(Services.Caster.UI + '/admin?section=Workspaces');

      const disableToggle = page.getByRole('switch', { name: 'Disable Workspace Operations' });
      const banner = page.getByRole('status').filter({ hasText: 'Workspace operations are disabled' });
      await expect(disableToggle).toBeEnabled({ timeout: 10000 });
      await expect(disableToggle).not.toBeChecked();
      await expect(banner).toBeHidden();

      try {
        // 2. Toggle on
        // expect: the switch moves once the API has made the change, and a banner says what that stops
        await disableToggle.click();
        await expect(disableToggle).toBeChecked();
        await expect(banner).toBeVisible();

        // 4. Toggle back off
        // expect: the switch is off again and the banner is gone
        await disableToggle.click();
        await expect(disableToggle).not.toBeChecked();
        await expect(banner).toBeHidden();
      } finally {
        // Workspace operations are global: never leave them disabled for other specs.
        if (await disableToggle.isChecked()) {
          await disableToggle.click();
          await expect(disableToggle).not.toBeChecked();
        }
      }
    });
  });
}
