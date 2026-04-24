// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

test.describe('Administration - Roles', () => {
  test('Roles Section', async ({ citeAuthenticatedPage: page }) => {

    await navigateToAdminSection(page, 'Roles');

    const rolesTab = page.getByRole('tab', { name: 'Roles', exact: true });
    await expect(rolesTab).toBeVisible({ timeout: 10000 });

    const scoringModelRolesTab = page.getByRole('tab', { name: 'Scoring Model Roles' });
    await expect(scoringModelRolesTab).toBeVisible({ timeout: 5000 });

    const evaluationRolesTab = page.getByRole('tab', { name: 'Evaluation Roles' });
    await expect(evaluationRolesTab).toBeVisible({ timeout: 5000 });

    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });
  });
});
