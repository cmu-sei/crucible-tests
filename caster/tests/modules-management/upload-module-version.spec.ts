// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Modules Management', () => {
  test('Upload Module Version', async ({ casterAuthenticatedPage: page }) => {

    await page.goto(Services.Caster.UI + '/admin?section=Modules');
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible({ timeout: 10000 });

    const externalModuleInput = page.getByRole('textbox', { name: 'External Module ID' });
    await expect(externalModuleInput).toBeVisible();
    await externalModuleInput.fill('test-module-upload');
    await expect(externalModuleInput).toHaveValue('test-module-upload');
  });
});
