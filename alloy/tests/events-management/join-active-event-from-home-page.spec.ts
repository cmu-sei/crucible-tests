// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Events Management', () => {
  test('Join Active Event from Home Page', async ({ page }) => {
    // 1. Navigate to http://localhost:4403 (home page)
    await authenticateWithKeycloak(page, Services.Alloy.UI);

    // expect: Home page displays list of user's events
    await expect(page.getByText('My Events')).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    // 2. Verify event template links are clickable
    const scenarioLink = page.getByRole('link', { name: 'Scenario Template' });
    if (await scenarioLink.isVisible()) {
      // Click on the event template
      await scenarioLink.click();

      // expect: The application navigates to the event view
      await expect(page).toHaveURL(/\/templates\//);
    }
  });
});
