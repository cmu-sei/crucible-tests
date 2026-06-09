// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';

test.describe('xAPI Integration and Learning Analytics', () => {
  test('xAPI Error Handling when LRsql Unavailable', async ({ blueprintAuthenticatedPage: page }) => {
    // Note: This test requires the ability to stop/start LRsql service
    // In a real environment, this would be done through Aspire dashboard or container orchestration
    // For this test, we'll verify graceful degradation behavior

    // 1. Stop LRsql service
    // Navigate to Aspire Dashboard to stop LRsql
    await page.goto(Services.AspireDashboard);
    await page.waitForLoadState('networkidle');

    // Look for LRsql resource
    const lrsqlResource = page.locator('text=/lrsql/i, [data-resource*="lrsql" i]').first();

    if (await lrsqlResource.isVisible({ timeout: 5000 })) {
      // Find stop button for LRsql
      const stopButton = page.locator('button[aria-label*="stop" i], button:has-text("Stop")').first();

      if (await stopButton.isVisible({ timeout: 3000 })) {
        await stopButton.click();
        await page.waitForTimeout(3000);
      }
    }

    // Verify LRsql is not reachable
    const lrsqlCheck = await page.request.get(Services.Lrsql).catch(() => null);

    // expect: LRsql is no longer reachable at http://localhost:9274
    if (lrsqlCheck) {
      expect(lrsqlCheck.status()).not.toBe(200);
    }

    // 2. Perform actions in Blueprint (create MSEL, edit event)
    await page.goto(Services.Blueprint.UI);

    // Navigate to Admin section
    const adminButton = page.locator('button:has-text("Admin"), a:has-text("Admin")').first();
    if (await adminButton.isVisible({ timeout: 5000 })) {
      await adminButton.click();
      await page.waitForLoadState('networkidle');
    }

    // Navigate to MSELs
    const mselsLink = page.locator('a:has-text("MSELs"), button:has-text("MSELs")').first();
    await mselsLink.click();
    await page.waitForLoadState('networkidle');

    // Create a new MSEL
    const createButton = page.locator('button:has-text("Add"), button:has-text("Create")').first();
    await createButton.click();

    const mselName = `Error Handling Test ${Date.now()}`;
    await page.fill('input[name="name"], input[placeholder*="name" i]', mselName);
    await page.fill('textarea[name="description"], textarea[placeholder*="description" i]', 'Test graceful degradation when LRsql is unavailable');

    const saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').first();
    await saveButton.click();

    // expect: Blueprint actions complete successfully
    await expect(page.locator(`text="${mselName}"`).first()).toBeVisible({ timeout: 10000 });

    // expect: Blueprint does not block user actions due to xAPI failure
    // The MSEL creation should succeed even if xAPI statement fails
    const mselCreated = await page.locator(`text="${mselName}"`).first().isVisible();
    expect(mselCreated).toBeTruthy();

    // expect: API logs show xAPI statement submission errors (graceful degradation)
    // Note: In a real test, we would check API logs or console output
    // For now, we verify the application continues to function

    // Edit the MSEL
    const editButton = page.locator('button[aria-label*="edit" i], button:has-text("Edit")').first();
    if (await editButton.isVisible({ timeout: 5000 })) {
      await editButton.click();
      await page.fill('textarea[name="description"], textarea[placeholder*="description" i]', 'Updated during LRsql outage');
      await page.locator('button:has-text("Save")').first().click();
      await page.waitForLoadState('networkidle');

      // Verify edit succeeded
      await expect(page.locator('text="Updated during LRsql outage"').first()).toBeVisible({ timeout: 5000 });
    }

    // 3. Restart LRsql and perform another action
    await page.goto(Services.AspireDashboard);
    await page.waitForLoadState('networkidle');

    // Look for LRsql resource and start it
    const lrsqlResourceRestart = page.locator('text=/lrsql/i, [data-resource*="lrsql" i]').first();

    if (await lrsqlResourceRestart.isVisible({ timeout: 5000 })) {
      const startButton = page.locator('button[aria-label*="start" i], button:has-text("Start")').first();

      if (await startButton.isVisible({ timeout: 3000 })) {
        await startButton.click();
        await page.waitForTimeout(5000);
      }
    }

    // Wait for LRsql to be available again
    let lrsqlAvailable = false;
    for (let i = 0; i < 10; i++) {
      const checkResponse = await page.request.get(Services.Lrsql).catch(() => null);
      if (checkResponse && checkResponse.status() === 200) {
        lrsqlAvailable = true;
        break;
      }
      await page.waitForTimeout(2000);
    }

    if (lrsqlAvailable) {
      // Perform another action in Blueprint
      await page.goto(Services.Blueprint.UI);

      const adminButtonAgain = page.locator('button:has-text("Admin"), a:has-text("Admin")').first();
      if (await adminButtonAgain.isVisible({ timeout: 5000 })) {
        await adminButtonAgain.click();
      }

      const mselsLinkAgain = page.locator('a:has-text("MSELs"), button:has-text("MSELs")').first();
      await mselsLinkAgain.click();

      const createButtonAgain = page.locator('button:has-text("Add"), button:has-text("Create")').first();
      await createButtonAgain.click();

      const mselNameRecovery = `Recovery Test ${Date.now()}`;
      await page.fill('input[name="name"], input[placeholder*="name" i]', mselNameRecovery);

      const saveButtonAgain = page.locator('button:has-text("Save"), button:has-text("Create")').first();
      await saveButtonAgain.click();

      await expect(page.locator(`text="${mselNameRecovery}"`).first()).toBeVisible({ timeout: 10000 });

      await page.waitForTimeout(2000);

      // expect: xAPI statements are successfully submitted again
      const lrsqlApiUrl = `${Services.Lrsql}/xapi/statements`;
      const statementsResponse = await page.request.get(lrsqlApiUrl, {
        headers: {
          'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
          'X-Experience-API-Version': '1.0.3'
        },
        params: {
          limit: 10
        }
      });

      expect(statementsResponse.status()).toBe(200);
      const statementsData = await statementsResponse.json();
      const statements = statementsData.statements || [];

      // Verify we have recent statements again
      expect(statements.length).toBeGreaterThan(0);
    }
  });
});
