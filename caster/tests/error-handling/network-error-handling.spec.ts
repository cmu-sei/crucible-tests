// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Error Handling and Validation', () => {
  test('Network Error Handling', async ({ casterAuthenticatedPage: page, context, cleanupCasterProject }) => {

    await expect(page.getByText('My Projects')).toBeVisible();

    // Simulate network disconnection by blocking API calls
    await context.route('**/api/**', (route) => route.abort());

    await page.locator('button[mattooltip="Add New Project"]').click();
    const dialog = page.getByRole('dialog', { name: 'Create New Project?' });
    if (await dialog.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.getByRole('textbox', { name: 'Name' }).fill('Network Test');
      await page.getByRole('button', { name: 'Save' }).click();
    }

    // Restore network — the Angular app may retry the blocked POST and actually
    // create the project.  Wait briefly for a successful 201 so we can register
    // it for cleanup.  If no such response arrives the project was never created.
    await context.unrouteAll();

    try {
      const resp = await page.waitForResponse(
        (r) => r.url().includes('/api/projects') && r.request().method() === 'POST' && r.status() === 201,
        { timeout: 5000 },
      );
      const body = await resp.json();
      cleanupCasterProject(body.id);
    } catch {
      // No project was created — nothing to clean up
    }

    await expect(page.getByText('My Projects')).toBeVisible();
  });
});
