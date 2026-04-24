// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

test.describe('Administration - Submissions', () => {
  test('Submissions Section', async ({ citeAuthenticatedPage: page }) => {

    await navigateToAdminSection(page, 'Submissions');

    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });

    const evaluationFilter = page.getByRole('combobox', { name: 'Evaluation' });
    await expect(evaluationFilter).toBeVisible({ timeout: 5000 });

    const typesFilter = page.getByRole('combobox', { name: 'Types' });
    await expect(typesFilter).toBeVisible({ timeout: 5000 });
  });
});
