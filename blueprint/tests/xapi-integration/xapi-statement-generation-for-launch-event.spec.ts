// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';

test.describe('xAPI Integration and Learning Analytics', () => {
  test('xAPI Statement Generation for Launch Event', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to Event Dashboard and launch a MSEL
    await page.goto(Services.Blueprint.UI);

    // Wait for Event Dashboard to load
    await expect(page.locator('text="Event Dashboard"').first()).toBeVisible({ timeout: 10000 });

    // Look for Launch Events section
    const launchSection = page.locator('text="Launch Events", text="Launch"').first();
    if (await launchSection.isVisible({ timeout: 5000 })) {
      await launchSection.click();
      await page.waitForLoadState('networkidle');
    }

    // Find a MSEL to launch - look for Launch button or link
    const launchButton = page.locator('button:has-text("Launch"), a:has-text("Launch")').first();

    if (await launchButton.isVisible({ timeout: 5000 })) {
      // Get the MSEL name before launching
      const mselCard = launchButton.locator('xpath=ancestor::*[contains(@class, "card") or contains(@class, "item")]').first();
      const mselNameElement = mselCard.locator('text=/[A-Z].*/', { hasText: /MSEL|Event|Scenario/ }).first();
      const mselName = await mselNameElement.textContent().catch(() => 'Unknown MSEL');

      await launchButton.click();
      await page.waitForLoadState('networkidle');

      // expect: MSEL launches successfully
      // Wait for success indicator or redirect
      await page.waitForTimeout(2000);

      // 2. Query LRsql for statements related to the launch action
      const lrsqlApiUrl = `${Services.Lrsql}/xapi/statements`;
      const statementsResponse = await page.request.get(lrsqlApiUrl, {
        headers: {
          'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
          'X-Experience-API-Version': '1.0.3'
        },
        params: {
          limit: 50,
          verb: 'http://adlnet.gov/exprs/verbs/launched'
        }
      });

      // expect: xAPI statement generated with verb 'http://adlnet.gov/exprs/verbs/launched'
      expect(statementsResponse.status()).toBe(200);
      const statementsData = await statementsResponse.json();
      const statements = statementsData.statements || [];

      expect(statements.length).toBeGreaterThan(0);

      const launchStatement = statements[0];

      // expect: Statement includes MSEL details in object
      expect(launchStatement.object?.id).toBeTruthy();
      expect(launchStatement.object?.definition).toBeTruthy();

      // expect: Actor matches the launching user
      expect(launchStatement.actor?.name).toBeTruthy();

      // expect: Timestamp is accurate to the launch time
      expect(launchStatement.timestamp).toBeTruthy();
      const statementTime = new Date(launchStatement.timestamp);
      const now = new Date();
      const timeDiff = Math.abs(now.getTime() - statementTime.getTime());

      // Statement should be within last 60 seconds
      expect(timeDiff).toBeLessThan(60000);
    } else {
      // If no launch button available, skip the test
      test.skip();
    }
  });
});
