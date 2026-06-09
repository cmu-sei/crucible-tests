// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';

test.describe('xAPI Integration and Learning Analytics', () => {
  test('xAPI Statement Query and Filtering', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Perform multiple actions in Blueprint (create, edit, launch, view)
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

    const mselName = `Query Test MSEL ${Date.now()}`;
    await page.fill('input[name="name"], input[placeholder*="name" i]', mselName);
    await page.fill('textarea[name="description"], textarea[placeholder*="description" i]', 'Test MSEL for xAPI query filtering');

    const saveButton = page.locator('button:has-text("Save"), button:has-text("Create")').first();
    await saveButton.click();
    await expect(page.locator(`text="${mselName}"`).first()).toBeVisible({ timeout: 10000 });

    // Edit the MSEL
    await page.waitForTimeout(1000);
    const editButton = page.locator('button[aria-label*="edit" i], button:has-text("Edit")').first();
    if (await editButton.isVisible({ timeout: 5000 })) {
      await editButton.click();
      await page.fill('textarea[name="description"], textarea[placeholder*="description" i]', 'Updated for query test');
      await page.locator('button:has-text("Save")').first().click();
    }

    // Wait for statements to be sent
    await page.waitForTimeout(2000);

    // expect: Multiple xAPI statements are generated
    const lrsqlApiUrl = `${Services.Lrsql}/xapi/statements`;

    // 2. Query LRsql API with filter for actor = admin user
    const actorFilterResponse = await page.request.get(lrsqlApiUrl, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
        'X-Experience-API-Version': '1.0.3'
      },
      params: {
        limit: 50,
        agent: JSON.stringify({ name: 'admin' })
      }
    });

    // expect: Only statements for admin user are returned
    expect(actorFilterResponse.status()).toBe(200);
    const actorData = await actorFilterResponse.json();
    const actorStatements = actorData.statements || [];

    expect(actorStatements.length).toBeGreaterThan(0);
    actorStatements.forEach((statement: any) => {
      expect(statement.actor?.name).toBeTruthy();
    });

    // 3. Query LRsql API with filter for verb = 'created'
    const verbFilterResponse = await page.request.get(lrsqlApiUrl, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
        'X-Experience-API-Version': '1.0.3'
      },
      params: {
        limit: 50,
        verb: 'http://adlnet.gov/exprs/verbs/created'
      }
    });

    // expect: Only create action statements are returned
    expect(verbFilterResponse.status()).toBe(200);
    const verbData = await verbFilterResponse.json();
    const createStatements = verbData.statements || [];

    expect(createStatements.length).toBeGreaterThan(0);
    createStatements.forEach((statement: any) => {
      expect(statement.verb?.id).toBe('http://adlnet.gov/exprs/verbs/created');
    });

    // 4. Query LRsql API with since parameter for last hour
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    const sinceParam = oneHourAgo.toISOString();

    const sinceFilterResponse = await page.request.get(lrsqlApiUrl, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
        'X-Experience-API-Version': '1.0.3'
      },
      params: {
        limit: 50,
        since: sinceParam
      }
    });

    // expect: Only recent statements are returned
    expect(sinceFilterResponse.status()).toBe(200);
    const sinceData = await sinceFilterResponse.json();
    const recentStatements = sinceData.statements || [];

    expect(recentStatements.length).toBeGreaterThan(0);
    recentStatements.forEach((statement: any) => {
      const statementTime = new Date(statement.timestamp);
      expect(statementTime.getTime()).toBeGreaterThanOrEqual(oneHourAgo.getTime());
    });
  });
});
