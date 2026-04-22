// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

test.describe('Administration - Evaluations', () => {
  test('Expand Evaluation Details', async ({ citeAuthenticatedPage: page }) => {

    await navigateToAdminSection(page);

    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });

    const descriptionHeader = page.getByRole('columnheader', { name: 'Description' });
    await expect(descriptionHeader).toBeVisible({ timeout: 5000 });

    const statusHeader = page.getByRole('columnheader', { name: 'Status' });
    await expect(statusHeader).toBeVisible({ timeout: 5000 });
  });
});
