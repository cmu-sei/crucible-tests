// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services } from '../../fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication and Authorization', () => {
  test('Unauthorized Access Protection', async ({ page }) => {

    // 1. Clear all cookies and local storage to simulate unauthenticated state
    await page.context().clearCookies();

    // expect: Session is cleared

    // 2. Attempt to navigate directly to a protected route (e.g., http://localhost:4201/admin)
    await page.goto(Services.TopoMojo.UI + '/admin');

    // expect: User is redirected to Keycloak login page
    await expect(page).toHaveURL(/localhost:8443.*realms\/crucible/, { timeout: 70000 });

    // expect: Protected route is not accessible without authentication
  });
});
