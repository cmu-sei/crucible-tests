// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, expectCasterProjectOpen, CASTER_THEMES, setCasterTheme } from '../../fixtures';

for (const theme of CASTER_THEMES) {
  test.describe(`${theme} theme › Accessibility and Usability`, () => {
    test('Loading States and Feedback', async ({ casterAuthenticatedPage: page, cleanupCasterProject }) => {
      await setCasterTheme(page, theme);

      await expect(page.getByRole('button', { name: 'Admin User', exact: true })).toBeVisible();

      // The add-project button is the only button sibling of "My Projects" text
      await page.getByText('My Projects').locator('..').getByRole('button').click();
      await expect(page.getByRole('dialog', { name: 'Create New Project?' })).toBeVisible();
      const projectName = `Loading Test Project ${Date.now()}`;
      await page.getByRole('textbox', { name: 'Name' }).fill(projectName);

      const saveButton = page.getByRole('button', { name: 'Save' });
      await expect(saveButton).toBeEnabled();
      await saveButton.click();

      // expect: Dialog closes and project appears
      cleanupCasterProject(await expectCasterProjectOpen(page, projectName));
      await expect(page.getByRole('dialog', { name: 'Create New Project?' })).not.toBeVisible();
    });
  });
}
