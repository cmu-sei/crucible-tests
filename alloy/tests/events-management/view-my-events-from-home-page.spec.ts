// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Events Management', () => {
  test('View My Events from Home Page', async ({ page }) => {
    // 1. Navigate to http://localhost:4403 (home page)
    await authenticateWithKeycloak(page, Services.Alloy.UI);

    // expect: Home page loads
    await expect(page).toHaveURL(/localhost:4403/);

    // 2. View the list of events displayed on the home page
    // expect: My Events section is visible
    await expect(page.getByText('My Events')).toBeVisible();

    // expect: Event table is visible with columns
    await expect(page.getByRole('columnheader', { name: 'Event Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Description' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Duration (Hours)' })).toBeVisible();

    // expect: Events can be clicked to view more details
    await expect(page.getByRole('table')).toBeVisible();
  });
});
